import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { User, LogOut, Plus, Trash2, Building2, Clock, AlertCircle } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gvfaxuzoisjjbootvcqu.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZmF4dXpvaXNqamJvb3R2Y3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzc4NjYsImV4cCI6MjA3ODgxMzg2Nn0.a9LDduCQCMfHX6L4Znnticljxi4iKE5tyzschDfS1-I';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Data state
  const [employees, setEmployees] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Employee management state
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeNumber, setNewEmployeeNumber] = useState('');

  // Committee management state
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [newCommitteeChair, setNewCommitteeChair] = useState('');

  // Volunteer clock in/out state
  const [loginInput, setLoginInput] = useState('');
  const [loggedInEmployee, setLoggedInEmployee] = useState(null);
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [clockOutNotes, setClockOutNotes] = useState('');

  // Initialize auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh data (but not during user interactions)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loginInput && !loggedInEmployee) {
        loadData();
      }
    }, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [loginInput, loggedInEmployee]);

  const loadUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      setUserProfile(data);
      
      if (data.role === 'admin') {
        loadData();
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadData = async () => {
    try {
      const [empRes, comRes, entRes] = await Promise.all([
        supabase.from('employees').select('*').order('name'),
        supabase.from('committees').select('*').order('name'),
        supabase.from('time_entries').select('*').order('clock_in', { ascending: false })
      ]);

      if (empRes.data) setEmployees(empRes.data);
      if (comRes.data) setCommittees(comRes.data);
      if (entRes.data) {
        // Auto clock out entries older than 12 hours
        const now = new Date();
        const entries = entRes.data;
        
        for (const entry of entries) {
          if (!entry.clock_out) {
            const clockInTime = new Date(entry.clock_in);
            const hoursSinceClockIn = (now - clockInTime) / 3600000;
            
            if (hoursSinceClockIn >= 12) {
              const autoClockOutTime = new Date(clockInTime);
              autoClockOutTime.setHours(autoClockOutTime.getHours() + 12);
              
              await supabase.from('time_entries')
                .update({
                  clock_out: autoClockOutTime.toISOString(),
                  notes: (entry.notes || '') + (entry.notes ? ' | ' : '') + '[Auto clocked out after 12 hours]'
                })
                .eq('id', entry.id);
            }
          }
        }
        
        // Reload after auto clock outs
        const updatedEntRes = await supabase.from('time_entries').select('*').order('clock_in', { ascending: false });
        if (updatedEntRes.data) setTimeEntries(updatedEntRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Get fiscal year dates (March 1 - Feb 28)
  const getCurrentFiscalYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    if (currentMonth >= 2) { // March or later
      return { 
        start: new Date(currentYear, 2, 1), 
        end: new Date(currentYear + 1, 1, 28, 23, 59, 59) 
      };
    } else { // Jan or Feb
      return { 
        start: new Date(currentYear - 1, 2, 1), 
        end: new Date(currentYear, 1, 28, 23, 59, 59) 
      };
    }
  };

  // Calculate YTD approved hours for employee
  const getYTDHours = (employeeId) => {
    const { start, end } = getCurrentFiscalYear();
    
    return timeEntries
      .filter(e => 
        e.employee_id === employeeId && 
        e.clock_out && 
        e.status === 'approved' &&
        new Date(e.clock_in) >= start && 
        new Date(e.clock_in) <= end
      )
      .reduce((sum, e) => {
        const hours = (new Date(e.clock_out) - new Date(e.clock_in)) / 3600000;
        return sum + hours;
      }, 0);
  };

  // Employee management
  const addEmployee = async () => {
    if (!newEmployeeName.trim() || !newEmployeeNumber.trim()) {
      alert('Please fill in both name and employee number');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(newEmployeeNumber.trim())) {
      alert('Employee number can only contain letters, numbers, hyphens, and underscores.');
      return;
    }

    if (!/^[a-zA-Z\s'-]+$/.test(newEmployeeName.trim())) {
      alert('Employee name can only contain letters, spaces, hyphens, and apostrophes.');
      return;
    }

    const exists = employees.some(e => e.number === newEmployeeNumber.trim());
    if (exists) {
      alert('Employee number already exists!');
      return;
    }

    try {
      const { error } = await supabase.from('employees').insert({
        id: Date.now(),
        name: newEmployeeName.trim(),
        number: newEmployeeNumber.trim()
      });

      if (error) throw error;

      setNewEmployeeName('');
      setNewEmployeeNumber('');
      loadData();
      alert('✅ Employee added!');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const deleteEmployee = async (id) => {
    if (!confirm('Delete this employee?')) return;

    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      loadData();
      alert('✅ Employee deleted!');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Committee management
  const addCommittee = async () => {
    if (!newCommitteeName.trim() || !newCommitteeChair.trim()) {
      alert('Please fill in both committee name and chair name');
      return;
    }

    if (!/^[a-zA-Z0-9\s&'-]+$/.test(newCommitteeName.trim())) {
      alert('Committee name can only contain letters, numbers, spaces, and basic punctuation.');
      return;
    }

    if (!/^[a-zA-Z\s'-]+$/.test(newCommitteeChair.trim())) {
      alert('Chair name can only contain letters, spaces, hyphens, and apostrophes.');
      return;
    }

    try {
      const { error } = await supabase.from('committees').insert({
        id: Date.now(),
        name: newCommitteeName.trim(),
        chair: newCommitteeChair.trim(),
        password: ''
      });

      if (error) throw error;

      setNewCommitteeName('');
      setNewCommitteeChair('');
      loadData();
      alert('✅ Committee added!');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const deleteCommittee = async (id) => {
    if (!confirm('Delete this committee?')) return;

    try {
      const { error } = await supabase.from('committees').delete().eq('id', id);
      if (error) throw error;
      loadData();
      alert('✅ Committee deleted!');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Volunteer login
  const handleVolunteerLogin = () => {
    if (!loginInput.trim()) return;
    
    const input = loginInput.trim().toLowerCase().replace(/[<>]/g, '');
    const employee = employees.find(e => 
      e.number.toLowerCase() === input || e.name.toLowerCase() === input
    );
    
    if (employee) {
      setLoggedInEmployee(employee);
      setLoginInput('');
      loadData(); // Refresh to show current status
    } else {
      alert('Employee not found. Please check name or number.');
      setLoginInput('');
    }
  };

  // Check if employee is currently clocked in
  const isClockedIn = () => {
    if (!loggedInEmployee) return false;
    return timeEntries.some(e => e.employee_id === loggedInEmployee.id && !e.clock_out);
  };

  // Clock in
  const clockIn = async () => {
    if (!loggedInEmployee || !selectedCommittee) {
      alert('Please select a committee');
      return;
    }
    
    const committee = committees.find(c => c.id === parseInt(selectedCommittee));
    if (!committee) return;
    
    // Check if already clocked in
    if (isClockedIn()) {
      alert('You are already clocked in! Please clock out first.');
      return;
    }
    
    try {
      const { error } = await supabase.from('time_entries').insert({
        id: Date.now(),
        employee_id: loggedInEmployee.id,
        employee_name: loggedInEmployee.name,
        employee_number: loggedInEmployee.number,
        committee_id: committee.id,
        committee_name: committee.name,
        clock_in: new Date().toISOString(),
        status: 'pending'
      });

      if (error) throw error;

      alert('✅ Clocked in successfully!');
      loadData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Clock out
  const clockOut = async () => {
    if (!loggedInEmployee) return;
    
    const activeEntry = timeEntries.find(e => 
      e.employee_id === loggedInEmployee.id && !e.clock_out
    );
    
    if (!activeEntry) {
      alert('No active clock in found!');
      return;
    }
    
    const sanitizedNotes = clockOutNotes.trim().replace(/[<>]/g, '');
    
    try {
      const { error } = await supabase.from('time_entries')
        .update({
          clock_out: new Date().toISOString(),
          notes: sanitizedNotes
        })
        .eq('id', activeEntry.id);

      if (error) throw error;

      alert('✅ Clocked out successfully!');
      setClockOutNotes('');
      setLoggedInEmployee(null);
      setSelectedCommittee('');
      loadData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Admin auth
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setEmployees([]);
      setCommittees([]);
      setTimeEntries([]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isAdmin = userProfile?.role === 'admin';

  // RENDER: Admin Dashboard
  if (user && userProfile && isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-2xl p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">Groton Sportsmen's Club</h1>
                <p className="text-gray-600 mt-1">Time Clock System - Step 3: Volunteer Clock In/Out</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <User size={48} className="text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Logged in as:</p>
                <p className="font-semibold text-lg">{user.email}</p>
                <p className="text-sm text-indigo-600 font-semibold">
                  Role: ADMIN
                </p>
              </div>
            </div>
          </div>

          {/* Admin Panels */}
          <div className="space-y-6">
            {/* Employee Management */}
            <div className="bg-white rounded-lg shadow-xl p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <User size={28} />
                Employee Management
              </h2>

              <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <h3 className="font-semibold mb-4">Add New Employee</h3>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    placeholder="Employee Name"
                    className="flex-1 px-4 py-3 border-2 rounded-lg text-lg"
                    onKeyPress={(e) => e.key === 'Enter' && newEmployeeNumber && addEmployee()}
                  />
                  <input
                    type="text"
                    value={newEmployeeNumber}
                    onChange={(e) => setNewEmployeeNumber(e.target.value)}
                    placeholder="Employee Number"
                    className="w-48 px-4 py-3 border-2 rounded-lg text-lg"
                    onKeyPress={(e) => e.key === 'Enter' && newEmployeeName && addEmployee()}
                  />
                  <button
                    onClick={addEmployee}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Add
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-4">
                  Employees ({employees.length})
                </h3>

                {employees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No employees yet</p>
                  </div>
                ) : (
                  <div className="border-2 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-4 text-left font-semibold">Number</th>
                          <th className="p-4 text-left font-semibold">Name</th>
                          <th className="p-4 text-left font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((emp, idx) => (
                          <tr 
                            key={emp.id} 
                            className={`border-t hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                          >
                            <td className="p-4 font-mono">{emp.number}</td>
                            <td className="p-4 font-semibold">{emp.name}</td>
                            <td className="p-4">
                              <button
                                onClick={() => deleteEmployee(emp.id)}
                                className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Committee Management */}
            <div className="bg-white rounded-lg shadow-xl p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Building2 size={28} />
                Committee Management
              </h2>

              <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                <h3 className="font-semibold mb-4">Add New Committee</h3>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newCommitteeName}
                    onChange={(e) => setNewCommitteeName(e.target.value)}
                    placeholder="Committee Name"
                    className="flex-1 px-4 py-3 border-2 rounded-lg text-lg"
                    onKeyPress={(e) => e.key === 'Enter' && newCommitteeChair && addCommittee()}
                  />
                  <input
                    type="text"
                    value={newCommitteeChair}
                    onChange={(e) => setNewCommitteeChair(e.target.value)}
                    placeholder="Chair Name"
                    className="flex-1 px-4 py-3 border-2 rounded-lg text-lg"
                    onKeyPress={(e) => e.key === 'Enter' && newCommitteeName && addCommittee()}
                  />
                  <button
                    onClick={addCommittee}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Add
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-4">
                  Committees ({committees.length})
                </h3>

                {committees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No committees yet</p>
                  </div>
                ) : (
                  <div className="border-2 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-4 text-left font-semibold">Committee Name</th>
                          <th className="p-4 text-left font-semibold">Chair</th>
                          <th className="p-4 text-left font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {committees.map((com, idx) => (
                          <tr 
                            key={com.id} 
                            className={`border-t hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                          >
                            <td className="p-4 font-semibold">{com.name}</td>
                            <td className="p-4">{com.chair}</td>
                            <td className="p-4">
                              <button
                                onClick={() => deleteCommittee(com.id)}
                                className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="bg-green-50 rounded-lg border-2 border-green-200 p-4">
              <p className="text-sm text-green-800">
                ✅ <strong>Step 3 Complete:</strong> Volunteer clock in/out is available!<br/>
                <strong>Next:</strong> We'll add Committee Chair login & approval dashboard (Step 4)
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: Volunteer Clock In/Out Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-2xl p-8 mb-6">
          <h1 className="text-4xl font-bold text-center mb-2">
            Groton Sportsmen's Club
          </h1>
          <div className="text-3xl font-semibold text-center text-indigo-600 mb-6">
            {currentTime.toLocaleTimeString()}
          </div>
          <p className="text-center text-gray-600">
            {currentTime.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Volunteer not logged in */}
        {!loggedInEmployee && (
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Volunteer Time Clock</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-lg font-semibold mb-3">
                  Enter Your Name or Employee Number
                </label>
                <input
                  type="text"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleVolunteerLogin()}
                  placeholder="John Smith or 101"
                  className="w-full px-6 py-4 border-2 rounded-lg text-xl focus:border-indigo-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <button
                onClick={handleVolunteerLogin}
                className="w-full px-8 py-4 bg-indigo-600 text-white rounded-lg text-xl font-semibold hover:bg-indigo-700 flex items-center justify-center gap-3"
              >
                <User size={28} />
                Continue
              </button>

              <div className="pt-6 border-t-2">
                <button
                  onClick={() => setUser({})}
                  className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 flex items-center justify-center gap-2"
                >
                  <LogIn size={20} />
                  Admin/Chair Login
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Volunteer logged in - NOT clocked in */}
        {loggedInEmployee && !isClockedIn() && (
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2">
                Welcome, {loggedInEmployee.name}!
              </h2>
              <p className="text-gray-600">Employee #{loggedInEmployee.number}</p>
              <p className="text-sm text-indigo-600 font-semibold mt-2">
                Fiscal Year Hours: {getYTDHours(loggedInEmployee.id).toFixed(2)} (approved)
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-lg font-semibold mb-3">
                  Select Committee
                </label>
                <select
                  value={selectedCommittee}
                  onChange={(e) => setSelectedCommittee(e.target.value)}
                  className="w-full px-6 py-4 border-2 rounded-lg text-xl focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Choose a committee...</option>
                  {committees.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={clockIn}
                disabled={!selectedCommittee}
                className="w-full px-8 py-6 bg-green-600 text-white rounded-lg text-2xl font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Clock size={32} />
                Clock In
              </button>

              <button
                onClick={() => setLoggedInEmployee(null)}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Volunteer logged in - CLOCKED IN */}
        {loggedInEmployee && isClockedIn() && (
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} className="text-green-600" />
                <div>
                  <p className="font-bold text-green-800">Currently Clocked In</p>
                  <p className="text-sm text-green-700">{loggedInEmployee.name}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-lg font-semibold mb-3">
                  What did you work on today? (Optional)
                </label>
                <textarea
                  value={clockOutNotes}
                  onChange={(e) => setClockOutNotes(e.target.value)}
                  placeholder="Describe your work..."
                  className="w-full px-6 py-4 border-2 rounded-lg text-lg focus:border-indigo-500 focus:outline-none resize-none"
                  rows="4"
                />
              </div>

              <button
                onClick={clockOut}
                className="w-full px-8 py-6 bg-red-600 text-white rounded-lg text-2xl font-bold hover:bg-red-700 flex items-center justify-center gap-3"
              >
                <Clock size={32} />
                Clock Out
              </button>

              <button
                onClick={() => setLoggedInEmployee(null)}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              >
                Cancel (Stay Clocked In)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Login form for admin/chair (triggered by button) */}
      {user && !userProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-center mb-6">
              Admin/Chair Login
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border-2 rounded-lg focus:border-indigo-500 focus:outline-none"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border-2 rounded-lg focus:border-indigo-500 focus:outline-none"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <button
                type="button"
                onClick={() => setUser(null)}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
