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
      return { data: await res.json(), error: null };
    },
    insert: async (data) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(data)
      });
      return { data: await res.json(), error: null };
    },
    update: async (data) => ({
      eq: async (column, value) => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        return { data: await res.json(), error: null };
      }
    }),
    delete: () => ({
      eq: async (column, value) => {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`, {
          method: 'DELETE',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        return { error: null };
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
  const dateFormat = { year: 'numeric', month: '2-digit', day: '2-digit' };
  const [loginInput, setLoginInput] = useState('');
  const [loggedInEmployee, setLoggedInEmployee] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null });
  const [clockOutNotes, setClockOutNotes] = useState('');
  const [showDateRangeExport, setShowDateRangeExport] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
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
      console.error('Error loading data:', error);
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
        alert('Employee number already exists!');
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
      alert('Please fill in committee name, chair name, and password.');
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
        const number = String(row['Employee Number'] || row['Number'] || row['employee_number'] || '').trim();
        let name = String(row['Employee Name'] || row['Name'] || row['employee_name'] || '').trim();

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
        alert(`Successfully imported ${importedEmployees.length} employees!${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}`);
        loadData();
      } else {
        alert('No valid employees found in file.');
      }
    } catch (error) {
      alert('Error reading file. Please make sure it is a valid CSV or Excel file.');
    }

    event.target.value = '';
  };
  const handleLogin = () => {
    if (!loginInput.trim()) return;
    
    const input = loginInput.trim().toLowerCase();
    const employee = employees.find(e => 
      e.number.toLowerCase() === input || 
      e.name.toLowerCase() === input
    );
    
    if (employee) {
      setLoggedInEmployee(employee);
      setLoginInput('');
    } else {
      alert('Employee not found. Please check your name or employee number.');
      setLoginInput('');
    }
  };

  const handleLogout = () => {
    setLoggedInEmployee(null);
    setSelectedCommittee('');
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

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setLoggedInCommittee(null);
    setShowAdmin(false);
  };

  const deleteEmployee = (employeeId) => {
    const employeeName = employees.find(e => e.id === employeeId)?.name;
    setConfirmDialog({
      show: true,
      message: `Delete ${employeeName}? This will also remove all their time entries.`,
      onConfirm: async () => {
        await supabase.from('employees').delete().eq('id', employeeId);
        await supabase.from('time_entries').delete().eq('employee_id', employeeId);
        setConfirmDialog({ show: false, message: '', onConfirm: null });
        loadData();
      }
    });
  };

  const deleteCommittee = (committeeId) => {
    const committeeName = committees.find(c => c.id === committeeId)?.name;
    setConfirmDialog({
      show: true,
      message: `Delete ${committeeName}? This will also remove all related time entries.`,
      onConfirm: async () => {
        await supabase.from('committees').delete().eq('id', committeeId);
        await supabase.from('time_entries').delete().eq('committee_id', committeeId);
        setConfirmDialog({ show: false, message: '', onConfirm: null });
        loadData();
      }
    });
  };

  const resetAllData = () => {
    setConfirmDialog({
      show: true,
      message: '⚠️ WARNING: This will delete ALL employees, committees, and time entries. This cannot be undone. Are you sure?',
      onConfirm: async () => {
        for (const emp of employees) {
          await supabase.from('employees').delete().eq('id', emp.id);
        }
        for (const com of committees) {
          await supabase.from('committees').delete().eq('id', com.id);
        }
        for (const entry of timeEntries) {
          await supabase.from('time_entries').delete().eq('id', entry.id);
        }
        setConfirmDialog({ show: false, message: '', onConfirm: null });
        loadData();
      }
    });
  };
  const approveEntry = async (entryId) => {
    await supabase.from('time_entries').update({ status: 'approved' }).eq('id', entryId);
    loadData();
  };

  const rejectEntry = async (entryId) => {
    await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', entryId);
    loadData();
  };

  const approveAllForWeek = async (weekStart, weekEnd, committeeId = null) => {
    const entriesToApprove = timeEntries.filter(entry => {
      const entryDate = new Date(entry.clock_in);
      const matchesWeek = entryDate >= weekStart && entryDate <= weekEnd && entry.clock_out;
      const matchesCommittee = committeeId ? entry.committee_id === committeeId : true;
      return matchesWeek && matchesCommittee && entry.status === 'pending';
    });

    for (const entry of entriesToApprove) {
      await supabase.from('time_entries').update({ status: 'approved' }).eq('id', entry.id);
    }
    loadData();
  };

  const clockIn = async () => {
    if (!loggedInEmployee || !selectedCommittee) {
      alert('Please select a committee before clocking in.');
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
      handleLogout();
      loadData();
    }
  };

  const calculateHours = (clockIn, clockOut) => {
    if (!clockOut) return 0;
    const diff = new Date(clockOut) - new Date(clockIn);
    return diff / 3600000;
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
      .filter(e => e.employee_id === employeeId && 
        e.clock_out &&
        e.status === 'approved' &&
        new Date(e.clock_in) >= fiscalYear.start &&
        new Date(e.clock_in) <= fiscalYear.end)
      .reduce((total, entry) => total + calculateHours(entry.clock_in, entry.clock_out), 0);
  };

  const getWeekDates = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const sunday = new Date(d.setDate(diff));
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    return { start: sunday, end: saturday };
  };
  const exportWeeklyReports = () => {
    const now = new Date();
    const week = getWeekDates(now);
    exportReportsByDateRange(week.start, week.end, 'Weekly');
  };

  const exportReportsByDateRange = (startDate, endDate, reportType = 'Custom') => {
    const rangeEntries = timeEntries.filter(e => {
      const entryDate = new Date(e.clock_in);
      return entryDate >= startDate && entryDate <= endDate && e.clock_out;
    });

    if (rangeEntries.length === 0) {
      alert('No time entries found for the selected date range.');
      return;
    }

    const wb = XLSX.utils.book_new();

    const masterData = rangeEntries.map(entry => ({
      'Employee Number': entry.employee_number,
      'Employee Name': entry.employee_name,
      'Committee': entry.committee_name,
      'Date': new Date(entry.clock_in).toLocaleDateString(),
      'Clock In': new Date(entry.clock_in).toLocaleTimeString(),
      'Clock Out': new Date(entry.clock_out).toLocaleTimeString(),
      'Hours': calculateHours(entry.clock_in, entry.clock_out).toFixed(2),
      'Status': entry.status || 'pending',
      'Notes': entry.notes || ''
    }));
    
    const masterWs = XLSX.utils.json_to_sheet(masterData);
    XLSX.utils.book_append_sheet(wb, masterWs, 'Master Report');

    committees.forEach(committee => {
      const committeeEntries = rangeEntries.filter(e => e.committee_id === committee.id);
      if (committeeEntries.length > 0) {
        const committeeData = committeeEntries.map(entry => ({
          'Employee Number': entry.employee_number,
          'Employee Name': entry.employee_name,
          'Date': new Date(entry.clock_in).toLocaleDateString(),
          'Clock In': new Date(entry.clock_in).toLocaleTimeString(),
          'Clock Out': new Date(entry.clock_out).toLocaleTimeString(),
          'Hours': calculateHours(entry.clock_in, entry.clock_out).toFixed(2),
          'Status': entry.status || 'pending',
          'Notes': entry.notes || ''
        }));
        
        const committeeWs = XLSX.utils.json_to_sheet(committeeData);
        const sheetName = committee.name.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, committeeWs, sheetName);
      }
    });

    const startStr = startDate.toLocaleDateString().replace(/\//g, '-');
    const endStr = endDate.toLocaleDateString().replace(/\//g, '-');
    XLSX.writeFile(wb, `${reportType}-Report-${startStr}-to-${endStr}.xlsx`);
  };

  const exportCommitteeReport = (committeeId) => {
    const committee = committees.find(c => c.id === committeeId);
    if (!committee) return;

    const now = new Date();
    const week = getWeekDates(now);
    
    const committeeEntries = timeEntries.filter(e => {
      const entryDate = new Date(e.clock_in);
      return e.committee_id === committeeId && 
             entryDate >= week.start && 
             entryDate <= week.end && 
             e.clock_out;
    });

    if (committeeEntries.length === 0) {
      alert('No time entries found for this week.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const committeeData = committeeEntries.map(entry => ({
      'Employee Number': entry.employee_number,
      'Employee Name': entry.employee_name,
      'Date': new Date(entry.clock_in).toLocaleDateString(),
      'Clock In': new Date(entry.clock_in).toLocaleTimeString(),
      'Clock Out': new Date(entry.clock_out).toLocaleTimeString(),
      'Hours': calculateHours(entry.clock_in, entry.clock_out).toFixed(2),
      'Status': entry.status || 'pending',
      'Notes': entry.notes || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(committeeData);
    XLSX.utils.book_append_sheet(wb, ws, committee.name);
    
    const weekStart = week.start.toLocaleDateString().replace(/\//g, '-');
    XLSX.writeFile(wb, `${committee.name}-Report-${weekStart}.xlsx`);
  };

  const handleDateRangeExport = () => {
    if (!exportStartDate || !exportEndDate) {
      alert('Please select both start and end dates.');
      return;
    }

    const start = new Date(exportStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(exportEndDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      alert('Start date must be before end date.');
      return;
    }

    exportReportsByDateRange(start, end, 'Custom');
    setShowDateRangeExport(false);
    setExportStartDate('');
    setExportEndDate('');
  };

  const isEmployeeClockedIn = () => {
    if (!loggedInEmployee) return false;
    return timeEntries.some(
      e => e.employee_id === loggedInEmployee.id && !e.clock_out
    );
  };

  const ytdHours = loggedInEmployee ? getEmployeeYTDHours(loggedInEmployee.id) : 0;
  const fiscalYear = getCurrentFiscalYear();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <p className="text-xl font-semibold text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (showAdmin && !isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Settings className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Panel</h1>
            <p className="text-gray-600">Enter password to continue</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                placeholder="Enter admin password"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                autoFocus
              />
            </div>

            <button
              onClick={handleAdminLogin}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-lg font-semibold"
            >
              <LogIn className="w-5 h-5" />
              Login
            </button>

            <button
              onClick={() => setShowAdmin(false)}
              className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (showAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        {showDateRangeExport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4 w-full">
              <h3 className="text-xl font-bold mb-4">Export by Date Range</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => {
                    setShowDateRangeExport(false);
                    setExportStartDate('');
                    setExportEndDate('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDateRangeExport}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Export
                </button>
              </div>
            </div>
          </div>
        )}
        {confirmDialog.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <p className="text-lg mb-4">{confirmDialog.message}</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Settings className="w-8 h-8 text-indigo-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">
                    {loggedInCommittee ? `${loggedInCommittee.name} Chair` : 'Admin Panel'}
                  </h1>
                  {loggedInCommittee && (
                    <p className="text-sm text-gray-600">Chair: {loggedInCommittee.chair}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAdmin(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Back to Clock
                </button>
                <button
                  onClick={handleAdminLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Logout
                </button>
              </div>
            </div>

            {loggedInCommittee ? (
              <>
                <button
                  onClick={() => exportCommitteeReport(loggedInCommittee.id)}
                  className="w-full mb-6 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Export My Committee Report (Current Week)
                </button>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-xl font-bold mb-4 text-gray-800">Approve Hours - {loggedInCommittee.name}</h2>
                  {(() => {
                    const week = getWeekDates(new Date());
                    const committeeEntries = timeEntries.filter(e => {
                      const entryDate = new Date(e.clock_in);
                      return e.committee_id === loggedInCommittee.id && 
                             entryDate >= week.start && 
                             entryDate <= week.end && 
                             e.clock_out;
                    });

                    if (committeeEntries.length === 0) {
                      return <p className="text-gray-500 text-center py-8">No time entries for this week</p>;
                    }

                    const pendingCount = committeeEntries.filter(e => e.status === 'pending').length;

                    return (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm text-gray-600">Week: {week.start.toLocaleDateString()} - {week.end.toLocaleDateString()}</p>
                          {pendingCount > 0 && (
                            <button
                              onClick={() => approveAllForWeek(week.start, week.end, loggedInCommittee.id)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                            >
                              Approve All ({pendingCount})
                            </button>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-300">
                                <th className="text-left py-2 px-2">Employee</th>
                                <th className="text-left py-2 px-2">Date</th>
                                <th className="text-left py-2 px-2">Hours</th>
                                <th className="text-left py-2 px-2">Notes</th>
                                <th className="text-left py-2 px-2">Status</th>
                                <th className="text-left py-2 px-2">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {committeeEntries.map(entry => (
                                <tr key={entry.id} className="border-b border-gray-200">
                                  <td className="py-2 px-2">{entry.employee_name}</td>
                                  <td className="py-2 px-2">{new Date(entry.clock_in).toLocaleDateString()}</td>
                                  <td className="py-2 px-2 font-semibold">
                                    {formatHours(calculateHours(entry.clock_in, entry.clock_out))}
                                  </td>
                                  <td className="py-2 px-2 text-xs text-gray-600 max-w-xs truncate">
                                    {entry.notes || '-'}
                                  </td>
                                  <td className="py-2 px-2">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                      entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                                      entry.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {entry.status || 'pending'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2">
                                    {entry.status === 'pending' && (
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => approveEntry(entry.id)}
                                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => rejectEntry(entry.id)}
                                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            ) : (
              <>
              {timeEntries.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <button
                      onClick={exportWeeklyReports}
                      className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Export Current Week Reports
                    </button>
                    <button
                      onClick={() => setShowDateRangeExport(true)}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-5 h-5" />
                      Export by Date Range
                    </button>
                  </div>
                )}

                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setShowApprovals(false)}
                    className={`flex-1 px-6 py-3 rounded-lg transition ${!showApprovals ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Management
                  </button>
                  <button
                    onClick={() => setShowApprovals(true)}
                    className={`flex-1 px-6 py-3 rounded-lg transition ${showApprovals ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Approve Hours
                  </button>
                </div>
                {showApprovals ? (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">Approve Weekly Hours</h2>
                    {committees.map(committee => {
                      const week = getWeekDates(new Date());
                      const committeeEntries = timeEntries.filter(e => {
                        const entryDate = new Date(e.clock_in);
                        return e.committee_id === committee.id && 
                               entryDate >= week.start && 
                               entryDate <= week.end && 
                               e.clock_out;
                      });

                      if (committeeEntries.length === 0) return null;

                      const pendingCount = committeeEntries.filter(e => e.status === 'pending').length;

                      return (
                        <div key={committee.id} className="mb-6 p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-indigo-900">{committee.name}</h3>
                            {pendingCount > 0 && (
                              <button
                                onClick={() => approveAllForWeek(week.start, week.end, committee.id)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                              >
                                Approve All ({pendingCount})
                              </button>
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-300">
                                  <th className="text-left py-2 px-2">Employee</th>
                                  <th className="text-left py-2 px-2">Date</th>
                                  <th className="text-left py-2 px-2">Hours</th>
                                  <th className="text-left py-2 px-2">Notes</th>
                                  <th className="text-left py-2 px-2">Status</th>
                                  <th className="text-left py-2 px-2">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {committeeEntries.map(entry => (
                                  <tr key={entry.id} className="border-b border-gray-200">
                                    <td className="py-2 px-2">{entry.employee_name}</td>
                                    <td className="py-2 px-2">{new Date(entry.clock_in).toLocaleDateString()}</td>
                                    <td className="py-2 px-2 font-semibold">
                                      {formatHours(calculateHours(entry.clock_in, entry.clock_out))}
                                    </td>
                                    <td className="py-2 px-2 text-xs text-gray-600 max-w-xs truncate">
                                      {entry.notes || '-'}
                                    </td>
                                    <td className="py-2 px-2">
                                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                                        entry.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                        'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {entry.status || 'pending'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2">
                                      {entry.status === 'pending' && (
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => approveEntry(entry.id)}
                                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => rejectEntry(entry.id)}
                                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
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
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={newEmployeeName}
                            onChange={(e) => setNewEmployeeName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addEmployee()}
                            placeholder="Employee name"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <button
                            onClick={addEmployee}
                            className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                          >
                            Add Employee
                          </button>
                          
                          <div className="pt-2 border-t border-gray-300">
                            <label className="block w-full px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition cursor-pointer text-center">
                              <Upload className="w-4 h-4 inline mr-2" />
                              Import CSV/Excel
                              <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileImport}
                                className="hidden"
                              />
                            </label>
                            <p className="text-xs text-gray-600 mt-1 text-center">
                              Columns: "Employee Number" and "Employee Name"
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <h3 className="font-semibold mb-2">Current Employees:</h3>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {employees.map(emp => (
                              <div key={emp.id} className="text-sm p-2 bg-white rounded border flex justify-between items-center">
                                <span>#{emp.number} - {emp.name}</span>
                                <button
                                  onClick={() => deleteEmployee(emp.id)}
                                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                                >
                                  Delete
                                </button>
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
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={newCommitteeChair}
                            onChange={(e) => setNewCommitteeChair(e.target.value)}
                            placeholder="Chair name"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <input
                            type="password"
                            value={newCommitteePassword}
                            onChange={(e) => setNewCommitteePassword(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addCommittee()}
                            placeholder="Chair password"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <button
                            onClick={addCommittee}
                            className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                          >
                            Add Committee
                          </button>
                        </div>
                        <div className="mt-4">
                          <h3 className="font-semibold mb-2">Current Committees:</h3>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {committees.map(com => (
                              <div key={com.id} className="text-sm p-2 bg-white rounded border flex justify-between items-center">
                                <div>
                                  <div className="font-semibold">{com.name}</div>
                                  <div className="text-xs text-gray-600">Chair: {com.chair}</div>
                                </div>
                                <button
                                  onClick={() => deleteCommittee(com.id)}
                                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                      <h3 className="font-semibold text-red-900 mb-2">⚠️ Danger Zone</h3>
                      <p className="text-sm text-red-700 mb-3">This will permanently delete all data.</p>
                      <button
                        onClick={resetAllData}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
                      >
                        Reset All Data
                      </button>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h2 className="text-xl font-bold mb-4 text-gray-800">Recent Time Entries</h2>
                      {timeEntries.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No time entries yet</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b-2 border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Emp #</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Employee</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Committee</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Clock In</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Clock Out</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Hours</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {timeEntries.slice().reverse().map(entry => (
                                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="py-3 px-4 font-mono text-sm">#{entry.employee_number}</td>
                                  <td className="py-3 px-4">{entry.employee_name}</td>
                                  <td className="py-3 px-4">
                                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-sm">
                                      {entry.committee_name}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-sm">{new Date(entry.clock_in).toLocaleString()}</td>
                                  <td className="py-3 px-4 text-sm">
                                    {entry.clock_out ? new Date(entry.clock_out).toLocaleString() : 
                                      <span className="text-green-600 font-semibold">Active</span>}
                                  </td>
                                  <td className="py-3 px-4 font-semibold">
                                    {entry.clock_out ? formatHours(calculateHours(entry.clock_in, entry.clock_out)) : 'Clocked In'}
                                  </td>
                                  <td className="py-3 px-4">
                                    {entry.clock_out && (
                                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                                        entry.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                        'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {entry.status || 'pending'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                                    {entry.notes || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
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
          <div className="text-center mb-8">
            <Clock className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Groton Sportsmen's Club</h1>
            <div className="text-2xl font-semibold text-gray-700">
              {currentTime.toLocaleTimeString()}
            </div>
            <div className="text-sm text-gray-500">
              {currentTime.toLocaleDateString()}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Enter Your Name or Employee Number
              </label>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Name or employee number"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                autoFocus
              />
            </div>

            <button
              onClick={handleLogin}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-lg font-semibold"
            >
              <LogIn className="w-5 h-5" />
              Login
            </button>

            <button
              onClick={() => setShowAdmin(true)}
              className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center justify-center gap-2"
            >
              <Settings className="w-5 h-5" />
              Admin Panel
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <Clock className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            Welcome, {loggedInEmployee.name}!
          </h2>
          <p className="text-sm text-gray-600">Employee #{loggedInEmployee.number}</p>
          <div className="text-xl font-semibold text-gray-700 mt-2">
            {currentTime.toLocaleTimeString()}
          </div>
        </div>

        <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Year to Date:
            </span>
            <span className="text-lg font-bold text-indigo-700">
              {formatHours(ytdHours)}
            </span>
          </div>
          <div className="text-xs text-indigo-600 mt-1">
            FY: {fiscalYear.start.toLocaleDateString()} - {fiscalYear.end.toLocaleDateString()}
          </div>
        </div>

        {!isEmployeeClockedIn() ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Committee
              </label>
              <select
                value={selectedCommittee}
                onChange={(e) => setSelectedCommittee(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Choose a committee...</option>
                {committees.map(com => (
                  <option key={com.id} value={com.id}>{com.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={clockIn}
              disabled={!selectedCommittee}
              className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed text-lg font-semibold"
            >
              Clock In
            </button>

            <button
              onClick={handleLogout}
              className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200 text-center">
              <p className="text-green-800 font-semibold mb-1">Currently Clocked In</p>
              <p className="text-sm text-green-700">
                {(() => {
                  const activeEntry = timeEntries.find(e => e.employee_id === loggedInEmployee.id && !e.clock_out);
                  return activeEntry ? committees.find(c => c.id === activeEntry.committee_id)?.name : 'Unknown Committee';
                })()}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={clockOutNotes}
                onChange={(e) => setClockOutNotes(e.target.value)}
                placeholder="What did you work on today?"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                rows="3"
              />
            </div>

            <button
              onClick={clockOut}
              className="w-full px-6 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-lg font-semibold"
            >
              Clock Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
