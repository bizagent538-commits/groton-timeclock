import React, { useState, useEffect } from 'react';
import { Clock, Download, User, Calendar, Building2, BarChart3, LogIn, Settings, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://gvfaxuzoisjjbootvcqu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZmF4dXpvaXNqamJvb3R2Y3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzc4NjYsImV4cCI6MjA3ODgxMzg2Nn0.a9LDduCQCMfHX6L4Znnticljxi4iKE5tyzschDfS1-I';

const supabase = {
  from: (table) => ({
    select: async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      return { data: await res.json() };
    },
    insert: async (data) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(data)
      });
      return { data: await res.json() };
    },
    update: (data) => ({
      eq: async (column, value) => {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
    }),
    delete: () => ({
      eq: async (column, value) => {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`, {
          method: 'DELETE',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
      }
    })
  })
};

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeNumber, setNewEmployeeNumber] = useState('');
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [newCommitteeChair, setNewCommitteeChair] = useState('');
  const [newCommitteePassword, setNewCommitteePassword] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loginInput, setLoginInput] = useState('');
  const [loggedInEmployee, setLoggedInEmployee] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [clockOutNotes, setClockOutNotes] = useState('');
  const [loggedInCommittee, setLoggedInCommittee] = useState(null);
  const ADMIN_PASSWORD = 'jackal';

  const loadData = async () => {
    try {
      const [empRes, comRes, entRes] = await Promise.all([
        supabase.from('employees').select(),
        supabase.from('committees').select(),
        supabase.from('time_entries').select()
      ]);
      setEmployees(empRes.data || []);
      setCommittees(comRes.data || []);
      setTimeEntries(entRes.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getCurrentFiscalYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    if (currentMonth >= 2) {
      return { start: new Date(currentYear, 2, 1), end: new Date(currentYear + 1, 1, 28, 23, 59, 59) };
    } else {
      return { start: new Date(currentYear - 1, 2, 1), end: new Date(currentYear, 1, 28, 23, 59, 59) };
    }
  };

  const addEmployee = async () => {
    if (newEmployeeName.trim() && newEmployeeNumber.trim()) {
      const exists = employees.some(e => e.number === newEmployeeNumber.trim());
      if (exists) {
        alert('Employee number exists!');
        return;
      }
      await supabase.from('employees').insert({
        id: Date.now(),
        name: newEmployeeName.trim(),
        number: newEmployeeNumber.trim()
      });
      setNewEmployeeName('');
      setNewEmployeeNumber('');
      loadData();
    }
  };

  const addCommittee = async () => {
    if (newCommitteeName.trim() && newCommitteeChair.trim() && newCommitteePassword.trim()) {
      await supabase.from('committees').insert({
        id: Date.now(),
        name: newCommitteeName.trim(),
        chair: newCommitteeChair.trim(),
        password: newCommitteePassword.trim()
      });
      setNewCommitteeName('');
      setNewCommitteeChair('');
      setNewCommitteePassword('');
      loadData();
    } else {
      alert('Fill all fields.');
    }
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      const importedEmployees = [];
      let skipped = 0;
      for (const row of jsonData) {
        const number = String(row['Employee Number'] || row['Number'] || '').trim();
        let name = String(row['Employee Name'] || row['Name'] || '').trim();
        if (name.includes(',')) {
          const parts = name.split(',').map(part => part.trim());
          if (parts.length === 2) {
            name = `${parts[1]} ${parts[0]}`;
          }
        }
        if (number && name) {
          const exists = employees.some(e => e.number === number);
          if (!exists) {
            importedEmployees.push({
              id: Date.now() + importedEmployees.length,
              name: name,
              number: number
            });
          } else {
            skipped++;
          }
        }
      }
      if (importedEmployees.length > 0) {
        await supabase.from('employees').insert(importedEmployees);
        alert(`Imported ${importedEmployees.length} employees!${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
        loadData();
      }
    } catch (error) {
      alert('Error reading file.');
    }
    event.target.value = '';
  };

  const handleLogin = () => {
    if (!loginInput.trim()) return;
    const input = loginInput.trim().toLowerCase();
    const employee = employees.find(e => 
      e.number.toLowerCase() === input || e.name.toLowerCase() === input
    );
    if (employee) {
      setLoggedInEmployee(employee);
      setLoginInput('');
    } else {
      alert('Not found.');
      setLoginInput('');
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      setLoggedInCommittee(null);
      setAdminPassword('');
    } else {
      const committee = committees.find(c => c.password === adminPassword);
      if (committee) {
        setIsAdminAuthenticated(true);
        setLoggedInCommittee(committee);
        setAdminPassword('');
      } else {
        alert('Incorrect password');
        setAdminPassword('');
      }
    }
  };

  const clockIn = async () => {
    if (!loggedInEmployee || !selectedCommittee) {
      alert('Select committee.');
      return;
    }
    const committee = committees.find(c => c.id === parseInt(selectedCommittee));
    await supabase.from('time_entries').insert({
      id: Date.now(),
      employee_id: loggedInEmployee.id,
      employee_name: loggedInEmployee.name,
      employee_number: loggedInEmployee.number,
      committee_id: committee.id,
      committee_name: committee.name,
      clock_in: new Date().toISOString(),
      clock_out: null,
      status: 'pending',
      notes: ''
    });
    setTimeout(() => {
      setLoggedInEmployee(null);
      setSelectedCommittee('');
      loadData();
    }, 1500);
  };

  const clockOut = async () => {
    if (!loggedInEmployee) return;
    const lastEntry = timeEntries
      .filter(e => e.employee_id === loggedInEmployee.id && !e.clock_out)
      .sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in))[0];
    if (lastEntry) {
      await supabase.from('time_entries').update({
        clock_out: new Date().toISOString(),
        notes: clockOutNotes.trim()
      }).eq('id', lastEntry.id);
      setClockOutNotes('');
      setLoggedInEmployee(null);
      setSelectedCommittee('');
      loadData();
    }
  };

  const calculateHours = (clockIn, clockOut) => {
    if (!clockOut) return 0;
    return (new Date(clockOut) - new Date(clockIn)) / 3600000;
  };

  const formatHours = (hours) => {
    if (hours === 0) return 'Clocked In';
    const h = Math.floor(hours);
    const m = Math.floor((hours % 1) * 60);
    return `${h}h ${m}m`;
  };

  const getEmployeeYTDHours = (employeeId) => {
    const fiscalYear = getCurrentFiscalYear();
    return timeEntries
      .filter(e => e.employee_id === employeeId && e.clock_out && e.status === 'approved' &&
        new Date(e.clock_in) >= fiscalYear.start && new Date(e.clock_in) <= fiscalYear.end)
      .reduce((total, entry) => total + calculateHours(entry.clock_in, entry.clock_out), 0);
  };

  const isEmployeeClockedIn = () => {
    if (!loggedInEmployee) return false;
    return timeEntries.some(e => e.employee_id === loggedInEmployee.id && !e.clock_out);
  };

  const ytdHours = loggedInEmployee ? getEmployeeYTDHours(loggedInEmployee.id) : 0;
  const fiscalYear = getCurrentFiscalYear();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Clock className="w-16 h-16 text-indigo-600 animate-pulse" />
      </div>
    );
  }

  if (showAdmin && !isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <Settings className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-center mb-8">Admin Panel</h1>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
            placeholder="Password"
            className="w-full px-4 py-3 border-2 rounded-lg mb-4"
            autoFocus
          />
          <button onClick={handleAdminLogin} className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg mb-2">
            Login
          </button>
          <button onClick={() => setShowAdmin(false)} className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (showAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Settings className="w-8 h-8 text-indigo-600" />
                <h1 className="text-3xl font-bold">{loggedInCommittee ? `${loggedInCommittee.name} Chair` : 'Admin Panel'}</h1>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAdmin(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg">
                  Back
                </button>
                <button onClick={() => { setIsAdminAuthenticated(false); setLoggedInCommittee(null); setShowAdmin(false); }} className="px-4 py-2 bg-red-600 text-white rounded-lg">
                  Logout
                </button>
              </div>
            </div>

            {!loggedInCommittee && (
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Add Employee
                  </h2>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newEmployeeNumber}
                      onChange={(e) => setNewEmployeeNumber(e.target.value)}
                      placeholder="Employee number"
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                    <input
                      type="text"
                      value={newEmployeeName}
                      onChange={(e) => setNewEmployeeName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addEmployee()}
                      placeholder="Employee name"
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                    <button onClick={addEmployee} className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg">
                      Add Employee
                    </button>
                    <div className="pt-2 border-t">
                      <label className="block w-full px-6 py-2 bg-emerald-600 text-white rounded-lg cursor-pointer text-center">
                        <Upload className="w-4 h-4 inline mr-2" />
                        Import CSV/Excel
                        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileImport} className="hidden" />
                      </label>
                      <p className="text-xs text-gray-600 mt-1 text-center">Columns: "Employee Number" and "Employee Name"</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Employees ({employees.length}):</h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {employees.map(emp => (
                        <div key={emp.id} className="text-sm p-2 bg-white rounded border">
                          #{emp.number} - {emp.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Add Committee
                  </h2>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newCommitteeName}
                      onChange={(e) => setNewCommitteeName(e.target.value)}
                      placeholder="Committee name"
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                    <input
                      type="text"
                      value={newCommitteeChair}
                      onChange={(e) => setNewCommitteeChair(e.target.value)}
                      placeholder="Chair name"
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                    <input
                      type="password"
                      value={newCommitteePassword}
                      onChange={(e) => setNewCommitteePassword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCommittee()}
                      placeholder="Chair password"
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                    <button onClick={addCommittee} className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg">
                      Add Committee
                    </button>
                  </div>
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Committees ({committees.length}):</h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {committees.map(com => (
                        <div key={com.id} className="text-sm p-2 bg-white rounded border">
                          <div className="font-semibold">{com.name}</div>
                          <div className="text-xs text-gray-600">Chair: {com.chair}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!loggedInEmployee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <Clock className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-center mb-2">Groton Sportsmen's Club</h1>
          <div className="text-2xl font-semibold text-center mb-8">{currentTime.toLocaleTimeString('en-US')}</div>
          <div className="text-sm text-center text-gray-600 mb-8">{currentTime.toLocaleDateString('en-US')}</div>
          <input
            type="text"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Name or employee number"
            className="w-full px-4 py-3 border-2 rounded-lg mb-4"
            autoFocus
          />
          <button onClick={handleLogin} className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg mb-2 text-lg font-semibold">
            <LogIn className="w-5 h-5 inline mr-2" />
            Login
          </button>
          <button onClick={() => setShowAdmin(true)} className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg">
            <Settings className="w-5 h-5 inline mr-2" />
            Admin Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <Clock className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-center mb-1">Welcome, {loggedInEmployee.name}!</h2>
        <p className="text-center text-sm text-gray-600 mb-4">Employee #{loggedInEmployee.number}</p>
        <div className="text-center text-xl font-semibold mb-6">{currentTime.toLocaleTimeString('en-US')}</div>
        
        <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Year to Date:
            </span>
            <span className="text-lg font-bold text-indigo-700">{formatHours(ytdHours)}</span>
          </div>
          <div className="text-xs text-indigo-600 mt-1">
            FY: {fiscalYear.start.toLocaleDateString('en-US')} - {fiscalYear.end.toLocaleDateString('en-US')}
          </div>
        </div>

        {!isEmployeeClockedIn() ? (
          <div className="space-y-4">
            <select
              value={selectedCommittee}
              onChange={(e) => setSelectedCommittee(e.target.value)}
              className="w-full px-4 py-3 border-2 rounded-lg"
            >
              <option value="">Choose committee...</option>
              {committees.map(com => (
                <option key={com.id} value={com.id}>{com.name}</option>
              ))}
            </select>
            <button
              onClick={clockIn}
              disabled={!selectedCommittee}
              className="w-full px-6 py-4 bg-green-600 text-white rounded-lg disabled:bg-gray-300 text-lg font-semibold"
            >
              Clock In
            </button>
            <button onClick={() => setLoggedInEmployee(null)} className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg">
              Logout
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <p className="text-green-800 font-semibold text-center">Currently Clocked In</p>
              <p className="text-sm text-green-700 text-center">
                {(() => {
                  const active = timeEntries.find(e => e.employee_id === loggedInEmployee.id && !e.clock_out);
                  return active ? committees.find(c => c.id === active.committee_id)?.name : '';
                })()}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Notes (Optional)</label>
              <textarea
                value={clockOutNotes}
                onChange={(e) => setClockOutNotes(e.target.value)}
                placeholder="What did you work on today?"
                className="w-full px-4 py-3 border-2 rounded-lg resize-none"
                rows="3"
              />
            </div>
            <button onClick={clockOut} className="w-full px-6 py-4 bg-red-600 text-white rounded-lg text-lg font-semibold">
              Clock Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
