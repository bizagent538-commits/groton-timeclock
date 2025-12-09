import React, { useState, useEffect } from 'react';
import { Clock, Download, User, Calendar, Building2, BarChart3, LogIn, LogOut, Settings, Upload, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Initialize Supabase client with official SDK
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gvfaxuzoisjjbootvcqu.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZmF4dXpvaXNqamJvb3R2Y3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzc4NjYsImV4cCI6MjA3ODgxMzg2Nn0.a9LDduCQCMfHX6L4Znnticljxi4iKE5tyzschDfS1-I';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function App() {
  // Data state
  const [employees, setEmployees] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Auth state
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState(''); // 'admin' or 'chair'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Employee state
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [loggedInEmployee, setLoggedInEmployee] = useState(null);
  const [clockOutNotes, setClockOutNotes] = useState('');
  
  // Admin state
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeNumber, setNewEmployeeNumber] = useState('');
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [newCommitteeChair, setNewCommitteeChair] = useState('');
  
  // UI state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDateRangeExport, setShowDateRangeExport] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  
  // Edit state
  const [editingEntry, setEditingEntry] = useState(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [selectedEntries, setSelectedEntries] = useState([]);

  // Initialize auth
  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        loadUserProfile(session.user.id);
      }
    });

    // Listen for auth changes
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

  // Load user profile
  const loadUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Auth functions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (error) throw error;

      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (error) {
      setAuthError(error.message || 'Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setLoggedInEmployee(null);
      setSelectedCommittee('');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const openAuthModal = (mode) => {
    setAuthMode(mode);
    setShowAuthModal(true);
    setAuthError('');
  };

  // Check roles
  const isAdmin = userProfile?.role === 'admin';
  const isChair = userProfile?.role === 'chair';
  const chairCommittee = isChair && userProfile ? 
    committees.find(c => c.id === userProfile.committee_id) : null;

  // Load data
  const loadData = async () => {
    setIsLoading(true);
    
    try {
      const [empRes, comRes, entRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('committees').select('*'),
        supabase.from('time_entries').select('*')
      ]);

      // Handle RLS policy errors gracefully
      if (empRes.error) {
        console.error('Error loading employees:', empRes.error);
        if (empRes.error.message.includes('infinite recursion') || empRes.error.code === '42P17') {
          // RLS policy issue - set empty arrays
          setEmployees([]);
        } else {
          throw empRes.error;
        }
      } else {
        setEmployees(empRes.data || []);
      }

      if (comRes.error) {
        console.error('Error loading committees:', comRes.error);
        if (comRes.error.message.includes('infinite recursion') || comRes.error.code === '42P17') {
          setCommittees([]);
        } else {
          throw comRes.error;
        }
      } else {
        setCommittees(comRes.data || []);
      }

      if (entRes.error) {
        console.error('Error loading time entries:', entRes.error);
        if (entRes.error.message.includes('infinite recursion') || entRes.error.code === '42P17') {
          setTimeEntries([]);
        } else {
          throw entRes.error;
        }
      } else {
        const entries = entRes.data || [];
        const now = new Date();
        
        // Auto clock out entries older than 12 hours
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
        
        const updatedEntRes = await supabase.from('time_entries').select('*');
        if (!updatedEntRes.error) {
          setTimeEntries(updatedEntRes.data || []);
        } else {
          setTimeEntries(entries);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Don't show alert on every refresh - just log it
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      // Don't reload if auth modal is open or user is in the middle of something
      if (!showAuthModal && !editingEntry) {
        loadData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [showAuthModal, editingEntry]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fiscal year helper
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

  // Employee functions
  const addEmployee = async () => {
    if (!isAdmin) return;
    
    if (newEmployeeName.trim() && newEmployeeNumber.trim()) {
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

  const deleteEmployee = async (id) => {
    if (!isAdmin) return;
    if (confirm('Delete this employee?')) {
      await supabase.from('employees').delete().eq('id', id);
      loadData();
    }
  };

  const handleFileImport = async (e) => {
    if (!isAdmin) return;
    
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const wb = XLSX.read(event.target.result);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        for (const row of data) {
          const name = row.Name || row.name || '';
          const number = String(row['Employee Number'] || row.number || row.Number || '');
          
          if (!name || !number) continue;
          
          const exists = employees.some(e => e.number === number);
          if (exists) continue;
          
          let processedName = name.trim();
          if (processedName.includes(',')) {
            const parts = processedName.split(',').map(part => part.trim());
            if (parts.length === 2) {
              processedName = `${parts[1]} ${parts[0]}`;
            }
          }
          
          await supabase.from('employees').insert({
            id: Date.now() + Math.random(),
            name: processedName,
            number: number
          });
        }
        
        loadData();
        alert(`Import successful!`);
      } catch (error) {
        alert(`Import error: ${error.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Committee functions
  const addCommittee = async () => {
    if (!isAdmin) return;
    
    if (newCommitteeName.trim() && newCommitteeChair.trim()) {
      if (!/^[a-zA-Z0-9\s&'-]+$/.test(newCommitteeName.trim())) {
        alert('Committee name can only contain letters, numbers, spaces, and basic punctuation.');
        return;
      }
      
      if (!/^[a-zA-Z\s'-]+$/.test(newCommitteeChair.trim())) {
        alert('Chair name can only contain letters, spaces, hyphens, and apostrophes.');
        return;
      }
      
      await supabase.from('committees').insert({
        id: Date.now(),
        name: newCommitteeName.trim(),
        chair: newCommitteeChair.trim(),
        password: '' // No longer used with auth
      });
      
      setNewCommitteeName('');
      setNewCommitteeChair('');
      loadData();
    } else {
      alert('Fill all fields.');
    }
  };

  const deleteCommittee = async (id) => {
    if (!isAdmin) return;
    if (confirm('Delete this committee?')) {
      await supabase.from('committees').delete().eq('id', id);
      loadData();
    }
  };

  const resetAllData = async () => {
    if (!isAdmin) return;
    if (confirm('DELETE ALL DATA? This cannot be undone!')) {
      if (confirm('Are you ABSOLUTELY SURE? All time entries, employees, and committees will be permanently deleted!')) {
        await Promise.all([
          supabase.from('time_entries').delete().neq('id', 0),
          supabase.from('employees').delete().neq('id', 0),
          supabase.from('committees').delete().neq('id', 0)
        ]);
        loadData();
        alert('All data deleted.');
      }
    }
  };

  // Volunteer login
  const handleLogin = () => {
    if (!loginInput.trim()) return;
    
    const input = loginInput.trim().toLowerCase().replace(/[<>]/g, '');
    
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

  // Clock in/out
  const clockIn = async () => {
    if (!loggedInEmployee || !selectedCommittee) return;
    
    const committee = committees.find(c => c.id === parseInt(selectedCommittee));
    if (!committee) return;
    
    const alreadyClockedIn = timeEntries.some(e => 
      e.employee_id === loggedInEmployee.id && !e.clock_out
    );
    
    if (alreadyClockedIn) {
      alert('Already clocked in!');
      return;
    }
    
    await supabase.from('time_entries').insert({
      id: Date.now(),
      employee_id: loggedInEmployee.id,
      employee_name: loggedInEmployee.name,
      employee_number: loggedInEmployee.number,
      committee_id: committee.id,
      committee_name: committee.name,
      clock_in: new Date().toISOString(),
      status: 'pending'
    });
    
    setLoggedInEmployee(null);
    setSelectedCommittee('');
    loadData();
  };

  const clockOut = async () => {
    if (!loggedInEmployee) return;
    
    const lastEntry = timeEntries
      .filter(e => e.employee_id === loggedInEmployee.id && !e.clock_out)
      .sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in))[0];
    
    if (lastEntry) {
      const sanitizedNotes = clockOutNotes.trim().replace(/[<>]/g, '');
      
      await supabase.from('time_entries')
        .update({
          clock_out: new Date().toISOString(),
          notes: sanitizedNotes
        })
        .eq('id', lastEntry.id);
      
      setClockOutNotes('');
      setLoggedInEmployee(null);
      setSelectedCommittee('');
      loadData();
    }
  };

  // Approval functions
  const approveEntry = async (id) => {
    if (!isAdmin && !isChair) return;
    await supabase.from('time_entries').update({ status: 'approved' }).eq('id', id);
    loadData();
  };

  const rejectEntry = async (id) => {
    if (!isAdmin && !isChair) return;
    await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id);
    loadData();
  };

  // Edit functions
  const startEditEntry = (entry) => {
    setEditingEntry(entry);
    setEditClockIn(new Date(entry.clock_in).toISOString().slice(0, 16));
    setEditClockOut(entry.clock_out ? new Date(entry.clock_out).toISOString().slice(0, 16) : '');
    setEditNotes(entry.notes || '');
  };

  const cancelEdit = () => {
    setEditingEntry(null);
    setEditClockIn('');
    setEditClockOut('');
    setEditNotes('');
  };

  const saveEdit = async () => {
    if (!editingEntry) return;
    
    const clockInDate = new Date(editClockIn);
    const clockOutDate = editClockOut ? new Date(editClockOut) : null;
    
    if (clockOutDate && clockOutDate <= clockInDate) {
      alert('Clock out must be after clock in!');
      return;
    }
    
    await supabase.from('time_entries')
      .update({
        clock_in: clockInDate.toISOString(),
        clock_out: clockOutDate ? clockOutDate.toISOString() : null,
        notes: editNotes
      })
      .eq('id', editingEntry.id);
    
    cancelEdit();
    loadData();
  };

  const deleteEntry = async (id) => {
    if (!isAdmin && !isChair) return;
    if (confirm('Delete this entry?')) {
      await supabase.from('time_entries').delete().eq('id', id);
      loadData();
    }
  };

  // Bulk operations
  const toggleEntrySelection = (entryId) => {
    setSelectedEntries(prev =>
      prev.includes(entryId)
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const toggleSelectAll = (committeeId) => {
    const pendingIds = timeEntries
      .filter(e => e.committee_id === committeeId && e.status === 'pending')
      .map(e => e.id);
    
    const allSelected = pendingIds.every(id => selectedEntries.includes(id));
    
    if (allSelected) {
      setSelectedEntries(prev => prev.filter(id => !pendingIds.includes(id)));
    } else {
      setSelectedEntries(prev => [...new Set([...prev, ...pendingIds])]);
    }
  };

  const bulkApprove = async () => {
    if (selectedEntries.length === 0) return;
    if (!confirm(`Approve ${selectedEntries.length} entries?`)) return;
    
    for (const id of selectedEntries) {
      await supabase.from('time_entries').update({ status: 'approved' }).eq('id', id);
    }
    
    setSelectedEntries([]);
    loadData();
  };

  const bulkReject = async () => {
    if (selectedEntries.length === 0) return;
    if (!confirm(`Reject ${selectedEntries.length} entries?`)) return;
    
    for (const id of selectedEntries) {
      await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id);
    }
    
    setSelectedEntries([]);
    loadData();
  };

  // Export functions
  const exportCommitteeReport = (committeeId) => {
    const committee = committees.find(c => c.id === committeeId);
    if (!committee) return;
    
    const committeeEntries = timeEntries.filter(e => e.committee_id === committeeId && e.clock_out);
    
    const data = committeeEntries.map(entry => ({
      'Employee Number': entry.employee_number,
      'Employee Name': entry.employee_name,
      'Date': new Date(entry.clock_in).toLocaleDateString(),
      'Clock In': new Date(entry.clock_in).toLocaleTimeString(),
      'Clock Out': new Date(entry.clock_out).toLocaleTimeString(),
      'Hours': ((new Date(entry.clock_out) - new Date(entry.clock_in)) / 3600000).toFixed(2),
      'Status': entry.status,
      'Notes': entry.notes || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, committee.name.slice(0, 31));
    XLSX.writeFile(wb, `${committee.name.replace(/[^a-z0-9]/gi, '_')}_report.xlsx`);
    
    alert('✅ Report downloaded! Check your downloads folder or tap the download arrow in your browser.');
  };

  const exportCommitteeReportByDateRange = (committeeId, startDate, endDate) => {
    const committee = committees.find(c => c.id === committeeId);
    if (!committee) return;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);
    
    const rangeEntries = timeEntries.filter(e => {
      const clockIn = new Date(e.clock_in);
      return e.committee_id === committeeId && e.clock_out &&
             clockIn >= start && clockIn <= end;
    });
    
    const data = rangeEntries.map(entry => ({
      'Employee Number': entry.employee_number,
      'Employee Name': entry.employee_name,
      'Date': new Date(entry.clock_in).toLocaleDateString(),
      'Clock In': new Date(entry.clock_in).toLocaleTimeString(),
      'Clock Out': new Date(entry.clock_out).toLocaleTimeString(),
      'Hours': ((new Date(entry.clock_out) - new Date(entry.clock_in)) / 3600000).toFixed(2),
      'Status': entry.status,
      'Notes': entry.notes || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, committee.name.slice(0, 31));
    XLSX.writeFile(wb, `${committee.name.replace(/[^a-z0-9]/gi, '_')}_${startDate}_to_${endDate}.xlsx`);
    
    alert('✅ Report downloaded! Check your downloads folder or tap the download arrow in your browser.');
  };

  const getCurrentMonthDates = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  };

  const getCurrentQuarterDates = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const quarter = Math.floor(month / 3);
    const start = new Date(year, quarter * 3, 1);
    const end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59);
    return { start, end };
  };

  const exportMonthlyReport = () => {
    const { start, end } = getCurrentMonthDates();
    if (isChair && chairCommittee) {
      exportCommitteeReportByDateRange(
        chairCommittee.id,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0]
      );
    } else if (isAdmin) {
      exportReportsByDateRange(
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0]
      );
    }
  };

  const exportQuarterlyReport = () => {
    const { start, end } = getCurrentQuarterDates();
    if (isChair && chairCommittee) {
      exportCommitteeReportByDateRange(
        chairCommittee.id,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0]
      );
    } else if (isAdmin) {
      exportReportsByDateRange(
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0]
      );
    }
  };

  const exportWeeklyReports = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const wb = XLSX.utils.book_new();
    
    committees.forEach(committee => {
      const committeeEntries = timeEntries.filter(e => {
        const clockIn = new Date(e.clock_in);
        return e.committee_id === committee.id && e.clock_out &&
               clockIn >= startOfWeek && clockIn <= endOfWeek;
      });
      
      if (committeeEntries.length > 0) {
        const data = committeeEntries.map(entry => ({
          'Employee Number': entry.employee_number,
          'Employee Name': entry.employee_name,
          'Date': new Date(entry.clock_in).toLocaleDateString(),
          'Clock In': new Date(entry.clock_in).toLocaleTimeString(),
          'Clock Out': new Date(entry.clock_out).toLocaleTimeString(),
          'Hours': ((new Date(entry.clock_out) - new Date(entry.clock_in)) / 3600000).toFixed(2),
          'Status': entry.status,
          'Notes': entry.notes || ''
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, committee.name.slice(0, 31));
      }
    });
    
    XLSX.writeFile(wb, `weekly_report_${startOfWeek.toISOString().split('T')[0]}.xlsx`);
    alert('✅ Report downloaded! Check your downloads folder or tap the download arrow in your browser.');
  };

  const exportReportsByDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);
    
    const wb = XLSX.utils.book_new();
    
    const allEntries = [];
    
    committees.forEach(committee => {
      const committeeEntries = timeEntries.filter(e => {
        const clockIn = new Date(e.clock_in);
        return e.committee_id === committee.id && e.clock_out &&
               clockIn >= start && clockIn <= end;
      });
      
      if (committeeEntries.length > 0) {
        const committeeData = committeeEntries.map(entry => ({
          'Employee Number': entry.employee_number,
          'Employee Name': entry.employee_name,
          'Date': new Date(entry.clock_in).toLocaleDateString(),
          'Clock In': new Date(entry.clock_in).toLocaleTimeString(),
          'Clock Out': new Date(entry.clock_out).toLocaleTimeString(),
          'Hours': ((new Date(entry.clock_out) - new Date(entry.clock_in)) / 3600000).toFixed(2),
          'Status': entry.status,
          'Notes': entry.notes || ''
        }));
        
        allEntries.push(...committeeData.map(d => ({ Committee: committee.name, ...d })));
        
        const ws = XLSX.utils.json_to_sheet(committeeData);
        XLSX.utils.book_append_sheet(wb, ws, committee.name.slice(0, 31));
      }
    });
    
    if (allEntries.length > 0) {
      const masterWs = XLSX.utils.json_to_sheet(allEntries);
      XLSX.utils.book_append_sheet(wb, masterWs, 'All Committees', 0);
    }
    
    XLSX.writeFile(wb, `report_${startDate}_to_${endDate}.xlsx`);
    setShowDateRangeExport(false);
    alert('✅ Report downloaded! Check your downloads folder or tap the download arrow in your browser.');
  };

  const handleDateRangeExport = () => {
    if (!exportStartDate || !exportEndDate) {
      alert('Please select both start and end dates');
      return;
    }
    
    if (isChair && chairCommittee) {
      exportCommitteeReportByDateRange(chairCommittee.id, exportStartDate, exportEndDate);
    } else {
      exportReportsByDateRange(exportStartDate, exportEndDate);
    }
  };

  const getTotalHoursForEmployee = (employeeId) => {
    const { start, end } = getCurrentFiscalYear();
    return timeEntries
      .filter(e => e.employee_id === employeeId && e.clock_out && e.status === 'approved' &&
              new Date(e.clock_in) >= start && new Date(e.clock_in) <= end)
      .reduce((sum, e) => sum + ((new Date(e.clock_out) - new Date(e.clock_in)) / 3600000), 0);
  };

  const isClockedIn = () => {
    return loggedInEmployee && timeEntries.some(e => e.employee_id === loggedInEmployee.id && !e.clock_out);
  };

  // Render
  if (isLoading) {
    return <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-2xl text-indigo-600">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-2xl p-8 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-center mb-2">Groton Sportsmen's Club</h1>
              <div className="text-2xl font-semibold text-center text-indigo-600 mb-8">
                {currentTime.toLocaleTimeString()}
              </div>
            </div>
            {(isAdmin || isChair) && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <LogOut size={20} />
                Logout
              </button>
            )}
          </div>

          {/* Auth Modal */}
          {showAuthModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-8 max-w-md w-full">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">
                    {authMode === 'admin' ? 'Admin Login' : 'Committee Chair Login'}
                  </h2>
                  <button onClick={() => setShowAuthModal(false)}>
                    <X size={24} />
                  </button>
                </div>
                
                <form onSubmit={handleAuth}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 rounded-lg mb-4"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-3 border-2 rounded-lg mb-4"
                    required
                  />
                  
                  {authError && (
                    <div className="text-red-600 mb-4">{authError}</div>
                  )}
                  
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
                  >
                    Login
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Volunteer Section */}
          {!loggedInEmployee && !isAdmin && !isChair && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <input
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Name or employee number"
                  className="flex-1 px-4 py-3 border-2 rounded-lg text-lg"
                />
                <button
                  onClick={handleLogin}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-lg text-lg font-semibold flex items-center gap-2 hover:bg-indigo-700"
                >
                  <User size={24} />
                  Login
                </button>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => openAuthModal('chair')}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg text-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700"
                >
                  <Building2 size={24} />
                  Committee Chair Login
                </button>
                <button
                  onClick={() => openAuthModal('admin')}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg text-lg font-semibold flex items-center justify-center gap-2 hover:bg-purple-700"
                >
                  <Settings size={24} />
                  Admin Panel
                </button>
              </div>
            </div>
          )}

          {/* Logged in employee */}
          {loggedInEmployee && !isClockedIn() && (
            <div className="space-y-4">
              <div className="text-xl font-semibold text-center">
                Welcome, {loggedInEmployee.name}!
              </div>
              <select
                value={selectedCommittee}
                onChange={(e) => setSelectedCommittee(e.target.value)}
                className="w-full px-4 py-3 border-2 rounded-lg text-lg"
              >
                <option value="">Select Committee</option>
                {committees.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={clockIn}
                disabled={!selectedCommittee}
                className="w-full px-6 py-4 bg-green-600 text-white rounded-lg text-lg font-semibold disabled:bg-gray-400"
              >
                Clock In
              </button>
              <div className="text-center text-sm text-gray-600">
                YTD Hours: {getTotalHoursForEmployee(loggedInEmployee.id).toFixed(2)}
              </div>
            </div>
          )}

          {/* Clocked in employee */}
          {loggedInEmployee && isClockedIn() && (
            <div className="space-y-4">
              <div className="text-xl font-semibold text-center text-green-600">
                Clocked In: {loggedInEmployee.name}
              </div>
              <textarea
                value={clockOutNotes}
                onChange={(e) => setClockOutNotes(e.target.value)}
                placeholder="What did you work on today?"
                className="w-full px-4 py-3 border-2 rounded-lg resize-none"
                rows="3"
              />
              <button
                onClick={clockOut}
                className="w-full px-6 py-4 bg-red-600 text-white rounded-lg text-lg font-semibold"
              >
                Clock Out
              </button>
            </div>
          )}
        </div>

        {/* Admin Panel */}
        {isAdmin && (
          <div className="bg-white rounded-lg shadow-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Settings size={28} />
              Admin Panel
            </h2>

            {/* Management Tabs */}
            <div className="space-y-8">
              {/* Employees */}
              <div>
                <h3 className="text-xl font-bold mb-4">Employees</h3>
                <div className="flex gap-4 mb-4">
                  <input
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    placeholder="Name"
                    className="flex-1 px-4 py-2 border-2 rounded-lg"
                  />
                  <input
                    value={newEmployeeNumber}
                    onChange={(e) => setNewEmployeeNumber(e.target.value)}
                    placeholder="Employee #"
                    className="w-40 px-4 py-2 border-2 rounded-lg"
                  />
                  <button
                    onClick={addEmployee}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                  >
                    Add
                  </button>
                  <label className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold cursor-pointer hover:bg-blue-700 flex items-center gap-2">
                    <Upload size={20} />
                    Import
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileImport}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="max-h-60 overflow-y-auto border-2 rounded-lg">
                  {employees.map(emp => (
                    <div key={emp.id} className="flex justify-between p-3 border-b hover:bg-gray-50">
                      <span>{emp.name} ({emp.number})</span>
                      <button
                        onClick={() => deleteEmployee(emp.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Committees */}
              <div>
                <h3 className="text-xl font-bold mb-4">Committees</h3>
                <div className="flex gap-4 mb-4">
                  <input
                    value={newCommitteeName}
                    onChange={(e) => setNewCommitteeName(e.target.value)}
                    placeholder="Committee Name"
                    className="flex-1 px-4 py-2 border-2 rounded-lg"
                  />
                  <input
                    value={newCommitteeChair}
                    onChange={(e) => setNewCommitteeChair(e.target.value)}
                    placeholder="Chair Name"
                    className="flex-1 px-4 py-2 border-2 rounded-lg"
                  />
                  <button
                    onClick={addCommittee}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                  >
                    Add
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto border-2 rounded-lg">
                  {committees.map(com => (
                    <div key={com.id} className="flex justify-between p-3 border-b hover:bg-gray-50">
                      <span>{com.name} - {com.chair}</span>
                      <button
                        onClick={() => deleteCommittee(com.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="border-4 border-red-600 rounded-lg p-4">
                <h3 className="text-xl font-bold text-red-600 mb-4">Danger Zone</h3>
                <button
                  onClick={resetAllData}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
                >
                  Reset All Data
                </button>
              </div>

              {/* Export */}
              <div>
                <h3 className="text-xl font-bold mb-4">Reports</h3>
                <div className="flex gap-4 flex-wrap">
                  <button
                    onClick={exportWeeklyReports}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
                  >
                    <Download size={20} />
                    Export Current Week
                  </button>
                  <button
                    onClick={exportMonthlyReport}
                    className="px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 flex items-center gap-2"
                  >
                    <Download size={20} />
                    Export Current Month
                  </button>
                  <button
                    onClick={exportQuarterlyReport}
                    className="px-6 py-3 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 flex items-center gap-2"
                  >
                    <Download size={20} />
                    Export Current Quarter
                  </button>
                  <button
                    onClick={() => setShowDateRangeExport(!showDateRangeExport)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Calendar size={20} />
                    Export by Date Range
                  </button>
                </div>

                {showDateRangeExport && (
                  <div className="mt-4 p-4 border-2 rounded-lg">
                    <div className="flex gap-4 items-center">
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="px-4 py-2 border-2 rounded-lg"
                      />
                      <span>to</span>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        className="px-4 py-2 border-2 rounded-lg"
                      />
                      <button
                        onClick={handleDateRangeExport}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                      >
                        Export
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chair Panel */}
        {isChair && chairCommittee && (
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {chairCommittee.name} - Approval Dashboard
              </h2>
              <div className="flex gap-4">
                <button
                  onClick={() => exportCommitteeReport(chairCommittee.id)}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
                >
                  <Download size={20} />
                  Export All Time Entries
                </button>
                <button
                  onClick={exportMonthlyReport}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 flex items-center gap-2"
                >
                  <Download size={20} />
                  Export Current Month
                </button>
                <button
                  onClick={exportQuarterlyReport}
                  className="px-6 py-3 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 flex items-center gap-2"
                >
                  <Download size={20} />
                  Export Current Quarter
                </button>
                <button
                  onClick={() => setShowDateRangeExport(!showDateRangeExport)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
                >
                  <Calendar size={20} />
                  Export by Date Range
                </button>
              </div>
            </div>

            {showDateRangeExport && (
              <div className="mb-6 p-4 border-2 rounded-lg">
                <div className="flex gap-4 items-center">
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="px-4 py-2 border-2 rounded-lg"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="px-4 py-2 border-2 rounded-lg"
                  />
                  <button
                    onClick={handleDateRangeExport}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                  >
                    Export
                  </button>
                </div>
              </div>
            )}

            {/* Time entries for chair's committee */}
            <div>
              {selectedEntries.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">
                    {selectedEntries.length} entries selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={bulkApprove}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Approve Selected
                    </button>
                    <button
                      onClick={bulkReject}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Reject Selected
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left">
                        <input
                          type="checkbox"
                          onChange={() => toggleSelectAll(chairCommittee.id)}
                          checked={timeEntries
                            .filter(e => e.committee_id === chairCommittee.id && e.status === 'pending')
                            .every(e => selectedEntries.includes(e.id))}
                        />
                      </th>
                      <th className="p-3 text-left">Employee</th>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Clock In</th>
                      <th className="p-3 text-left">Clock Out</th>
                      <th className="p-3 text-left">Hours</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Notes</th>
                      <th className="p-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeEntries
                      .filter(e => e.committee_id === chairCommittee.id)
                      .sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in))
                      .map(entry => (
                        <tr key={entry.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            {entry.status === 'pending' && (
                              <input
                                type="checkbox"
                                checked={selectedEntries.includes(entry.id)}
                                onChange={() => toggleEntrySelection(entry.id)}
                              />
                            )}
                          </td>
                          <td className="p-3">{entry.employee_name}</td>
                          <td className="p-3">{new Date(entry.clock_in).toLocaleDateString()}</td>
                          <td className="p-3">{new Date(entry.clock_in).toLocaleTimeString()}</td>
                          <td className="p-3">
                            {entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString() : '-'}
                          </td>
                          <td className="p-3">
                            {entry.clock_out 
                              ? ((new Date(entry.clock_out) - new Date(entry.clock_in)) / 3600000).toFixed(2)
                              : '-'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded ${
                              entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                              entry.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {entry.status}
                            </span>
                          </td>
                          <td className="p-3">{entry.notes || '-'}</td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              {entry.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => approveEntry(entry.id)}
                                    className="text-green-600 hover:text-green-800"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => rejectEntry(entry.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => startEditEntry(entry)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingEntry && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-6">Edit Time Entry</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Clock In</label>
                  <input
                    type="datetime-local"
                    value={editClockIn}
                    onChange={(e) => setEditClockIn(e.target.value)}
                    className="w-full px-4 py-2 border-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Clock Out</label>
                  <input
                    type="datetime-local"
                    value={editClockOut}
                    onChange={(e) => setEditClockOut(e.target.value)}
                    className="w-full px-4 py-2 border-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-4 py-2 border-2 rounded-lg resize-none"
                    rows="3"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={saveEdit}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
