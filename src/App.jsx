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
      alert('Error reading file.');
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
      alert('Employee not found.');
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
      message: `Delete ${employeeName}?`,
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
      message: `Delete ${committeeName}?`,
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
      message: '⚠️ WARNING: Delete ALL data?',
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
      alert('Please select a committee.');
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
      alert('No entries found.');
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
        XLSX.utils.book_append_sheet(wb, committeeWs, committee.name.substring(0, 31));
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
      return e.committee_id === committeeId && entryDate >= week.start && entryDate <= week.end && e.clock_out;
    });
    if (committeeEntries.length === 0) {
      alert('No entries found.');
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
      alert('Select both dates.');
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
    return timeEntries.some(e => e.employee_id === loggedInEmployee.id && !e.clock_out);
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
