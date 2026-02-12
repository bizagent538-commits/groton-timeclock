import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { User, LogOut, Plus, Trash2, Building2, Clock, AlertCircle, LogIn, CheckCircle, XCircle, Edit2, X, Upload, Download, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  const [newEmployeeHours, setNewEmployeeHours] = useState('');

  // Committee management state
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [newCommitteeChair, setNewCommitteeChair] = useState('');
  const [editingCommittee, setEditingCommittee] = useState(null);
  const [editCommitteeName, setEditCommitteeName] = useState('');
  const [editCommitteeChair, setEditCommitteeChair] = useState('');

  // Volunteer clock in/out state
  const [loginInput, setLoginInput] = useState('');
  const [loggedInEmployee, setLoggedInEmployee] = useState(null);
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [clockOutNotes, setClockOutNotes] = useState('');
  const [clockOutPhoto, setClockOutPhoto] = useState(null);
  const [clockOutPhotoPreview, setClockOutPhotoPreview] = useState('');

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editChairNotes, setEditChairNotes] = useState('');
  const chairNotesRef = React.useRef(null);

  // Bulk operations state
  const [selectedEntries, setSelectedEntries] = useState([]);

  // Export state
  const [showDateRangeExport, setShowDateRangeExport] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // Initialize auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        // Load data even if not authenticated (for volunteer login)
        loadData();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        // Load data for volunteer screen
        loadData();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update clock every second (but pause when editing to prevent re-renders)
  useEffect(() => {
    if (editingEntry) return; // Don't update clock while editing
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [editingEntry]);

  // Auto-refresh data
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loginInput && !loggedInEmployee && !editingEntry && (userProfile?.role === 'admin' || userProfile?.role === 'chair')) {
        loadData();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [loginInput, loggedInEmployee, editingEntry, userProfile]);

  const loadUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      if (data) {
        // Check if this chair has special permissions (Membership or Work Hours committee)
        if (data.role === 'chair' && data.committee_id) {
          // We'll check committee name after committees are loaded
          setUserProfile({ ...data, needsCommitteeCheck: true });
        } else {
          setUserProfile(data);
        }
      }
      
      loadData(); // Load data for everyone (volunteers need employee list)
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadData = async () => {
    try {
      const [empRes, comRes, entRes] = await Promise.all([
        supabase.from('members').select('*').eq('status', 'Active').order('last_name'),
        supabase.from('committees').select('*').order('name'),
        supabase.from('time_entries').select('*').order('clock_in', { ascending: false })
      ]);

      // Map members table fields to employee format expected by UI
      if (empRes.data) {
        const mappedEmployees = empRes.data.map(member => ({
          ...member,
          name: `${member.first_name} ${member.last_name}`.trim(),
          number: member.member_number || member.key_fob_number || ''
        }));
        setEmployees(mappedEmployees);
      }
      if (comRes.data) {
        setCommittees(comRes.data);
        
        // Check for special committee permissions
        if (userProfile && userProfile.needsCommitteeCheck && userProfile.committee_id) {
          const committee = comRes.data.find(c => c.id === userProfile.committee_id);
          if (committee) {
            const specialCommittees = ['membership', 'work hours', 'workhours', 'work-hours'];
            const isSpecialChair = specialCommittees.some(name => 
              committee.name.toLowerCase().includes(name)
            );
            if (isSpecialChair) {
              setUserProfile({ ...userProfile, hasEmployeeManagement: true, needsCommitteeCheck: false });
            } else {
              setUserProfile({ ...userProfile, needsCommitteeCheck: false });
            }
          }
        }
      }
      if (entRes.data) {
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
        
        const updatedEntRes = await supabase.from('time_entries').select('*').order('clock_in', { ascending: false });
        if (updatedEntRes.data) setTimeEntries(updatedEntRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const getCurrentFiscalYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    if (currentMonth >= 2) {
      return { 
        start: new Date(currentYear, 2, 1), 
        end: new Date(currentYear + 1, 1, 28, 23, 59, 59) 
      };
    } else {
      return { 
        start: new Date(currentYear - 1, 2, 1), 
        end: new Date(currentYear, 1, 28, 23, 59, 59) 
      };
    }
  };

  const getYTDHours = (employeeNumberOrId) => {
    const { start, end } = getCurrentFiscalYear();
    
    return timeEntries
      .filter(e => 
        (e.employee_id === employeeNumberOrId || e.employee_number === employeeNumberOrId) && 
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

  const calculateHours = (entry) => {
    if (!entry.clock_out) return 0;
    return (new Date(entry.clock_out) - new Date(entry.clock_in)) / 3600000;
  };

  // Employee management
  const addEmployee = async () => {
    if (!newEmployeeName.trim() || !newEmployeeNumber.trim()) {
      alert('Please fill in both name and member number');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(newEmployeeNumber.trim())) {
      alert('Member number can only contain letters, numbers, hyphens, and underscores.');
      return;
    }

    if (!/^[a-zA-Z\s'-]+$/.test(newEmployeeName.trim())) {
      alert('Member name can only contain letters, spaces, hyphens, and apostrophes.');
      return;
    }

    const exists = employees.some(e => e.number === newEmployeeNumber.trim());
    if (exists) {
      alert('Member number already exists!');
      return;
    }

    // Validate hours if provided
    const hours = newEmployeeHours.trim();
    if (hours && (isNaN(hours) || parseFloat(hours) < 0)) {
      alert('Hours must be a positive number');
      return;
    }

    try {
      // Split name into first and last name (split on last space)
      const nameParts = newEmployeeName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      // Add member to members table (let Supabase generate UUID)
      const { data: newMember, error: empError } = await supabase.from('members').insert({
        first_name: firstName,
        last_name: lastName,
        member_number: newEmployeeNumber.trim(),
        status: 'Active',
        tier: 'Regular'
      }).select().single();

      if (empError) throw empError;
      
      const employeeId = newMember.id; // Get the UUID that was generated

      // Add historical hours if provided
      if (hours && parseFloat(hours) > 0) {
        const hoursFloat = parseFloat(hours);
        const fiscalYear = getCurrentFiscalYear();
        const historicalDate = fiscalYear.start; // Use start of fiscal year
        
        const { error: entryError } = await supabase.from('time_entries').insert({
          employee_id: employeeId,
          employee_name: newEmployeeName.trim(),
          employee_number: newEmployeeNumber.trim(),
          committee_id: 0,
          committee_name: 'Historical Import',
          clock_in: historicalDate.toISOString(),
          clock_out: new Date(historicalDate.getTime() + (hoursFloat * 3600000)).toISOString(),
          status: 'approved',
          notes: 'Historical hours from before time clock system'
        });

        if (entryError) {
          console.error('Error adding historical hours:', entryError);
          alert(`⚠️ Employee added but historical hours failed to save`);
        }
      }

      setNewEmployeeName('');
      setNewEmployeeNumber('');
      setNewEmployeeHours('');
      loadData();
      
      if (hours && parseFloat(hours) > 0) {
        alert(`✅ Employee added with ${hours} historical hours!`);
      } else {
        alert('✅ Employee added!');
      }
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
        name: newCommitteeName.trim(),
        chair: newCommitteeChair.trim(),
        password: newCommitteeName.trim().substring(0, 4).toLowerCase()
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

  const startEditCommittee = (committee) => {
    setEditingCommittee(committee.id);
    setEditCommitteeName(committee.name);
    setEditCommitteeChair(committee.chair);
  };

  const cancelEditCommittee = () => {
    setEditingCommittee(null);
    setEditCommitteeName('');
    setEditCommitteeChair('');
  };

  const updateCommittee = async (id) => {
    if (!editCommitteeName.trim() || !editCommitteeChair.trim()) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase.from('committees').update({
        name: editCommitteeName.trim(),
        chair: editCommitteeChair.trim(),
        password: editCommitteeName.trim().substring(0, 4).toLowerCase()
      }).eq('id', id);

      if (error) throw error;
      loadData();
      cancelEditCommittee();
      alert('✅ Committee updated!');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Approval functions
  const approveEntry = async (id) => {
    try {
      const { error } = await supabase.from('time_entries')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const rejectEntry = async (id) => {
    try {
      const { error } = await supabase.from('time_entries')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Helper function to convert Date to local datetime string for input
  const toLocalDatetimeString = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper function to convert local datetime string to ISO string
  const localDatetimeToISO = (localDatetimeStr) => {
    const date = new Date(localDatetimeStr);
    return date.toISOString();
  };

  // Edit functions
  const startEditEntry = (entry) => {
    setEditingEntry(entry);
    setEditClockIn(toLocalDatetimeString(entry.clock_in));
    setEditClockOut(entry.clock_out ? toLocalDatetimeString(entry.clock_out) : '');
    
    // Split notes: volunteer notes vs chair/admin notes
    const allNotes = entry.notes || '';
    const separator = '\n--- Chair/Admin Notes ---\n';
    if (allNotes.includes(separator)) {
      const parts = allNotes.split(separator);
      setEditNotes(parts[0]);
      setEditChairNotes(parts[1]);
    } else {
      setEditNotes(allNotes);
      setEditChairNotes('');
    }
  };

  const cancelEdit = () => {
    setEditingEntry(null);
    setEditClockIn('');
    setEditClockOut('');
    setEditNotes('');
    setEditChairNotes('');
  };

  const saveEdit = async () => {
    if (!editingEntry) return;
    
    const clockInDate = new Date(editClockIn);
    const clockOutDate = editClockOut ? new Date(editClockOut) : null;
    
    if (clockOutDate && clockOutDate <= clockInDate) {
      alert('Clock out time must be after clock in time!');
      return;
    }
    
    // Combine volunteer notes and chair/admin notes
    let combinedNotes = editNotes.trim();
    const chairNotesText = (chairNotesRef.current?.value || '').trim();
    
    if (chairNotesText) {
      combinedNotes = combinedNotes 
        ? `${combinedNotes}\n--- Chair/Admin Notes ---\n${chairNotesText}`
        : `--- Chair/Admin Notes ---\n${chairNotesText}`;
    }
    
    try {
      const { error } = await supabase.from('time_entries')
        .update({
          clock_in: clockInDate.toISOString(),
          clock_out: clockOutDate ? clockOutDate.toISOString() : null,
          notes: combinedNotes
        })
        .eq('id', editingEntry.id);

      if (error) throw error;

      alert('✅ Time entry updated!');
      cancelEdit();
      loadData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const deleteEntry = async (id) => {
    if (!confirm('Delete this time entry? This cannot be undone.')) return;

    try {
      const { error } = await supabase.from('time_entries').delete().eq('id', id);
      if (error) throw error;
      loadData();
      alert('✅ Time entry deleted!');
    } catch (error) {
      alert(`Error: ${error.message}`);
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

  const toggleSelectAll = () => {
    const filteredIds = getFilteredEntries()
      .filter(e => e.status === 'pending' && e.clock_out)
      .map(e => e.id);
    
    const allSelected = filteredIds.every(id => selectedEntries.includes(id));
    
    if (allSelected) {
      setSelectedEntries(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedEntries(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const bulkApprove = async () => {
    if (selectedEntries.length === 0) return;
    if (!confirm(`Approve ${selectedEntries.length} entries?`)) return;
    
    try {
      for (const id of selectedEntries) {
        await supabase.from('time_entries').update({ status: 'approved' }).eq('id', id);
      }
      
      setSelectedEntries([]);
      loadData();
      alert(`✅ ${selectedEntries.length} entries approved!`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const bulkReject = async () => {
    if (selectedEntries.length === 0) return;
    if (!confirm(`Reject ${selectedEntries.length} entries?`)) return;
    
    try {
      for (const id of selectedEntries) {
        await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id);
      }
      
      setSelectedEntries([]);
      loadData();
      alert(`✅ ${selectedEntries.length} entries rejected!`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Excel Import
  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name);

    try {
      const data = await file.arrayBuffer();
      console.log('File read successfully, size:', data.byteLength);
      
      const workbook = XLSX.read(data);
      console.log('Workbook parsed, sheets:', workbook.SheetNames);
      
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      console.log('Rows parsed:', jsonData.length);
      console.log('First row:', jsonData[0]);

      let imported = 0;
      let skipped = 0;

      for (const row of jsonData) {
        // Handle various column name formats
        let name = String(
          row['Employee Name'] ||
          row['employee name'] || 
          row['member name'] || 
          row['Member Name'] || 
          row['Name'] || 
          row.name || 
          ''
        ).trim();
        
        const number = String(
          row['Employee Number'] || 
          row['employee number'] ||
          row.Number || 
          row.number || 
          row['Employee #'] || 
          ''
        ).trim();

        console.log('Processing row:', { originalName: name, number });

        if (!name || !number) {
          console.log('Skipping - missing name or number');
          skipped++;
          continue;
        }

        // Handle "Last, First" format - convert to "First Last"
        let firstName, lastName;
        if (name.includes(',')) {
          const parts = name.split(',').map(p => p.trim());
          if (parts.length === 2) {
            firstName = parts[1];
            lastName = parts[0];
            name = `${firstName} ${lastName}`; // "Smith, John" becomes "John Smith"
            console.log('Converted name to:', name);
          } else {
            // Split on last space
            const nameParts = name.split(' ');
            firstName = nameParts[0];
            lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
          }
        } else {
          // Split on last space
          const nameParts = name.split(' ');
          firstName = nameParts[0];
          lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        }

        // Check if already exists
        const exists = employees.some(e => e.number === number);
        if (exists) {
          console.log('Skipping - duplicate number:', number);
          skipped++;
          continue;
        }

        // Add member to members table
        console.log('Adding member:', { firstName, lastName, number });
        const { error: insertError } = await supabase.from('members').insert({
          first_name: firstName,
          last_name: lastName,
          member_number: number,
          status: 'Active',
          tier: 'Regular'
        });

        if (insertError) {
          console.error('Insert error for', name, ':', insertError);
          skipped++;
        } else {
          imported++;
        }
      }

      loadData();
      alert(`✅ Import complete!\nImported: ${imported}\nSkipped: ${skipped}`);
    } catch (error) {
      console.error('Import error:', error);
      alert(`Import error: ${error.message}`);
    }
    
    // Reset file input
    e.target.value = '';
  };

  // Date helpers
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
      'Hours': calculateHours(entry).toFixed(2),
      'Status': entry.status,
      'Notes': entry.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, committee.name.slice(0, 31));
    XLSX.writeFile(wb, `${committee.name.replace(/[^a-z0-9]/gi, '_')}_all_entries.xlsx`);

    alert('✅ Report downloaded!');
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
    let hasData = false;

    committees.forEach(committee => {
      const committeeEntries = timeEntries.filter(e => {
        const clockIn = new Date(e.clock_in);
        return e.committee_id === committee.id && e.clock_out &&
               clockIn >= startOfWeek && clockIn <= endOfWeek;
      });

      if (committeeEntries.length > 0) {
        hasData = true;
        const data = committeeEntries.map(entry => ({
          'Employee Number': entry.employee_number,
          'Employee Name': entry.employee_name,
          'Date': new Date(entry.clock_in).toLocaleDateString(),
          'Clock In': new Date(entry.clock_in).toLocaleTimeString(),
          'Clock Out': new Date(entry.clock_out).toLocaleTimeString(),
          'Hours': calculateHours(entry).toFixed(2),
          'Status': entry.status,
          'Notes': entry.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, committee.name.slice(0, 31));
      }
    });

    if (hasData) {
      XLSX.writeFile(wb, `weekly_report_${startOfWeek.toISOString().split('T')[0]}.xlsx`);
      alert('✅ Weekly report downloaded!');
    } else {
      alert('No data for this week.');
    }
  };

  const exportMonthlyReport = () => {
    const { start, end } = getCurrentMonthDates();
    exportReportsByDateRange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  };

  const exportQuarterlyReport = () => {
    const { start, end } = getCurrentQuarterDates();
    exportReportsByDateRange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  };

  const exportReportsByDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);

    const wb = XLSX.utils.book_new();
    const allEntries = [];
    let hasData = false;

    const committeesToExport = isChair && chairCommittee ? [chairCommittee] : committees;

    committeesToExport.forEach(committee => {
      const committeeEntries = timeEntries.filter(e => {
        const clockIn = new Date(e.clock_in);
        return e.committee_id === committee.id && e.clock_out &&
               clockIn >= start && clockIn <= end;
      });

      if (committeeEntries.length > 0) {
        hasData = true;
        const committeeData = committeeEntries.map(entry => ({
          'Employee Number': entry.employee_number,
          'Employee Name': entry.employee_name,
          'Date': new Date(entry.clock_in).toLocaleDateString(),
          'Clock In': new Date(entry.clock_in).toLocaleTimeString(),
          'Clock Out': new Date(entry.clock_out).toLocaleTimeString(),
          'Hours': calculateHours(entry).toFixed(2),
          'Status': entry.status,
          'Notes': entry.notes || ''
        }));

        allEntries.push(...committeeData.map(d => ({ Committee: committee.name, ...d })));

        const ws = XLSX.utils.json_to_sheet(committeeData);
        XLSX.utils.book_append_sheet(wb, ws, committee.name.slice(0, 31));
      }
    });

    if (hasData) {
      if (isAdmin && allEntries.length > 0) {
        const masterWs = XLSX.utils.json_to_sheet(allEntries);
        XLSX.utils.book_append_sheet(wb, masterWs, 'All Committees', 0);
      }

      XLSX.writeFile(wb, `report_${startDate}_to_${endDate}.xlsx`);
      setShowDateRangeExport(false);
      alert('✅ Report downloaded!');
    } else {
      alert('No data for this date range.');
    }
  };

  const handleDateRangeExport = () => {
    if (!exportStartDate || !exportEndDate) {
      alert('Please select both start and end dates');
      return;
    }

    exportReportsByDateRange(exportStartDate, exportEndDate);
  };

  // Grant-Ready Report Export
  const exportGrantReport = () => {
    const { start, end } = getCurrentFiscalYear();
    
    const wb = XLSX.utils.book_new();
    
    // Calculate totals
    const allApprovedEntries = timeEntries.filter(e => 
      e.clock_out && 
      e.status === 'approved' &&
      new Date(e.clock_in) >= start && 
      new Date(e.clock_in) <= end
    );

    let totalHours = 0;
    const committeeHours = {};
    const volunteerHours = {};

    allApprovedEntries.forEach(entry => {
      const hours = calculateHours(entry);
      totalHours += hours;

      // By committee
      if (!committeeHours[entry.committee_name]) {
        committeeHours[entry.committee_name] = 0;
      }
      committeeHours[entry.committee_name] += hours;

      // By volunteer
      const volKey = `${entry.employee_name} (#${entry.employee_number})`;
      if (!volunteerHours[volKey]) {
        volunteerHours[volKey] = 0;
      }
      volunteerHours[volKey] += hours;
    });

    // Summary Sheet
    const summaryData = [
      { '': 'GROTON SPORTSMEN\'S CLUB', ' ': '' },
      { '': 'VOLUNTEER HOURS GRANT REPORT', ' ': '' },
      { '': '', ' ': '' },
      { '': `Fiscal Year: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`, ' ': '' },
      { '': '', ' ': '' },
      { '': 'SUMMARY', ' ': '' },
      { '': 'Total Volunteer Hours:', ' ': totalHours.toFixed(2) },
      { '': 'Number of Volunteers:', ' ': Object.keys(volunteerHours).length },
      { '': 'Number of Committees:', ' ': Object.keys(committeeHours).length },
      { '': '', ' ': '' },
      { '': 'IN-KIND VALUE CALCULATION', ' ': '' },
      { '': 'Volunteer Hour Value:', ' ': '$29.95' },
      { '': 'Total In-Kind Contribution:', ' ': `$${(totalHours * 29.95).toFixed(2)}` },
      { '': '', ' ': '' },
      { '': 'Note: $29.95 is the 2024 Independent Sector volunteer hour value', ' ': '' },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData, { skipHeader: true });
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Hours by Committee Sheet
    const committeeData = Object.entries(committeeHours)
      .sort((a, b) => b[1] - a[1])
      .map(([committee, hours]) => ({
        'Committee': committee,
        'Total Hours': hours.toFixed(2),
        'Percentage': `${((hours / totalHours) * 100).toFixed(1)}%`,
        'In-Kind Value': `$${(hours * 29.95).toFixed(2)}`
      }));

    const committeeSheet = XLSX.utils.json_to_sheet(committeeData);
    XLSX.utils.book_append_sheet(wb, committeeSheet, 'By Committee');

    // Hours by Volunteer Sheet
    const volunteerData = Object.entries(volunteerHours)
      .sort((a, b) => b[1] - a[1])
      .map(([volunteer, hours]) => ({
        'Volunteer': volunteer,
        'Total Hours': hours.toFixed(2),
        'In-Kind Value': `$${(hours * 29.95).toFixed(2)}`
      }));

    const volunteerSheet = XLSX.utils.json_to_sheet(volunteerData);
    XLSX.utils.book_append_sheet(wb, volunteerSheet, 'By Volunteer');

    // Detailed Entries Sheet
    const detailedData = allApprovedEntries.map(entry => ({
      'Date': new Date(entry.clock_in).toLocaleDateString(),
      'Volunteer': entry.employee_name,
      'Employee #': entry.employee_number,
      'Committee': entry.committee_name,
      'Clock In': new Date(entry.clock_in).toLocaleTimeString(),
      'Clock Out': new Date(entry.clock_out).toLocaleTimeString(),
      'Hours': calculateHours(entry).toFixed(2),
      'Work Description': entry.notes || ''
    }));

    const detailedSheet = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Entries');

    // Save file
    const fiscalYearLabel = start.getFullYear();
    XLSX.writeFile(wb, `Grant_Report_FY${fiscalYearLabel}.xlsx`);

    alert('✅ Grant report downloaded!');
  };

  // Volunteer login
  const handleVolunteerLogin = () => {
    if (!loginInput.trim()) return;
    
    const input = loginInput.trim().toLowerCase().replace(/[<>]/g, '');
    const employee = employees.find(e => 
      (e.number || '').toLowerCase() === input || e.name.toLowerCase() === input
    );
    
    if (employee) {
      setLoggedInEmployee(employee);
      setLoginInput('');
      loadData();
    } else {
      alert('Employee not found. Please check name or number.');
      setLoginInput('');
    }
  };

  const isClockedIn = () => {
    if (!loggedInEmployee) return false;
    return timeEntries.some(e => 
      (e.employee_id === loggedInEmployee.id || e.employee_number === loggedInEmployee.number) && 
      !e.clock_out
    );
  };

  const clockIn = async () => {
    if (!loggedInEmployee || !selectedCommittee) {
      alert('Please select a committee');
      return;
    }
    
    const committee = committees.find(c => c.id === parseInt(selectedCommittee));
    if (!committee) return;
    
    if (isClockedIn()) {
      alert('You are already clocked in! Please clock out first.');
      return;
    }
    
    try {
      const { error } = await supabase.from('time_entries').insert({
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
      
      // Reset for next person
      setLoggedInEmployee(null);
      setSelectedCommittee('');
      loadData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const clockOut = async () => {
    if (!loggedInEmployee) return;
    
    const activeEntry = timeEntries.find(e => 
      (e.employee_id === loggedInEmployee.id || e.employee_number === loggedInEmployee.number) && 
      !e.clock_out
    );
    
    if (!activeEntry) {
      alert('No active clock in found!');
      return;
    }
    
    const sanitizedNotes = clockOutNotes.trim().replace(/[<>]/g, '');
    
    // Handle photo upload if there is one
    let photoUrl = null;
    if (clockOutPhoto) {
      try {
        const fileExt = clockOutPhoto.name.split('.').pop();
        const fileName = `${loggedInEmployee.id}_${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('time-entry-photos')
          .upload(fileName, clockOutPhoto);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('time-entry-photos')
          .getPublicUrl(fileName);
        
        photoUrl = urlData.publicUrl;
      } catch (error) {
        console.error('Photo upload error:', error);
        alert('⚠️ Photo upload failed, but time entry was saved');
      }
    }
    
    try {
      const { error } = await supabase.from('time_entries')
        .update({
          clock_out: new Date().toISOString(),
          notes: sanitizedNotes,
          photo_url: photoUrl
        })
        .eq('id', activeEntry.id);

      if (error) throw error;

      alert('✅ Clocked out successfully!');
      setClockOutNotes('');
      setClockOutPhoto(null);
      setClockOutPhotoPreview('');
      setLoggedInEmployee(null);
      setSelectedCommittee('');
      loadData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Handle photo selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be smaller than 5MB');
      return;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    setClockOutPhoto(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setClockOutPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setClockOutPhoto(null);
    setClockOutPhotoPreview('');
  };

  // Delete All Entries (Admin only - for testing)
  const deleteAllEntries = async () => {
    if (!confirm('⚠️ DELETE ALL TIME ENTRIES?\n\nThis will permanently delete ALL time entries in the system.\n\nThis action CANNOT be undone!\n\nType "DELETE ALL" to confirm.')) {
      return;
    }

    const confirmation = prompt('Type "DELETE ALL" to confirm:');
    if (confirmation !== 'DELETE ALL') {
      alert('Deletion cancelled - confirmation text did not match');
      return;
    }

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .neq('id', 0); // Delete all (neq 0 means everything)

      if (error) throw error;

      alert('✅ All time entries deleted!');
      loadData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

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
  const isChair = userProfile?.role === 'chair';
  const chairCommittee = isChair && userProfile?.committee_id 
    ? committees.find(c => c.id === userProfile.committee_id) 
    : null;

  const getFilteredEntries = () => {
    let entries = timeEntries;

    if (isChair && chairCommittee) {
      entries = entries.filter(e => e.committee_id === chairCommittee.id);
    }

    if (statusFilter !== 'all') {
      entries = entries.filter(e => e.status === statusFilter);
    }

    return entries;
  };

  const filteredEntries = getFilteredEntries();
  const pendingCount = isChair && chairCommittee
    ? timeEntries.filter(e => e.committee_id === chairCommittee.id && e.status === 'pending').length
    : timeEntries.filter(e => e.status === 'pending').length;

  // Time Entry Table Component (shared between Admin and Chair)
  const TimeEntryTable = () => {
    const pendingEntries = filteredEntries.filter(e => e.status === 'pending' && e.clock_out);
    const hasSelectableEntries = pendingEntries.length > 0;

    return (
      <div className="bg-white rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Time Entries</h2>
          
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                statusFilter === 'all' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                statusFilter === 'pending' 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                statusFilter === 'approved' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                statusFilter === 'rejected' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>

        {selectedEntries.length > 0 && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 flex justify-between items-center">
            <span className="font-semibold text-blue-800">
              {selectedEntries.length} entries selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={bulkApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center gap-2"
              >
                <CheckCircle size={20} />
                Approve Selected
              </button>
              <button
                onClick={bulkReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center gap-2"
              >
                <XCircle size={20} />
                Reject Selected
              </button>
              <button
                onClick={() => setSelectedEntries([])}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No time entries found</p>
          </div>
        ) : (
          <div className="border-2 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    {hasSelectableEntries && (
                      <th className="p-4 text-left">
                        <input
                          type="checkbox"
                          onChange={toggleSelectAll}
                          checked={pendingEntries.every(e => selectedEntries.includes(e.id))}
                          className="w-4 h-4"
                        />
                      </th>
                    )}
                    <th className="p-4 text-left font-semibold">Employee</th>
                    <th className="p-4 text-left font-semibold">Date</th>
                    <th className="p-4 text-left font-semibold">Clock In</th>
                    <th className="p-4 text-left font-semibold">Clock Out</th>
                    <th className="p-4 text-left font-semibold">Hours</th>
                    <th className="p-4 text-left font-semibold">Status</th>
                    <th className="p-4 text-left font-semibold">Notes</th>
                    <th className="p-4 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, idx) => (
                    <tr 
                      key={entry.id} 
                      className={`border-t hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      {hasSelectableEntries && (
                        <td className="p-4">
                          {entry.status === 'pending' && entry.clock_out && (
                            <input
                              type="checkbox"
                              checked={selectedEntries.includes(entry.id)}
                              onChange={() => toggleEntrySelection(entry.id)}
                              className="w-4 h-4"
                            />
                          )}
                        </td>
                      )}
                      <td className="p-4">
                        <div>
                          <p className="font-semibold">{entry.employee_name}</p>
                          <p className="text-sm text-gray-600">#{entry.employee_number}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        {new Date(entry.clock_in).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        {new Date(entry.clock_in).toLocaleTimeString()}
                      </td>
                      <td className="p-4">
                        {entry.clock_out 
                          ? new Date(entry.clock_out).toLocaleTimeString()
                          : <span className="text-green-600 font-semibold">Clocked In</span>
                        }
                      </td>
                      <td className="p-4 font-semibold">
                        {entry.clock_out ? calculateHours(entry).toFixed(2) : '-'}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                          entry.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="p-4 max-w-xs">
                        <p className="text-sm text-gray-600 truncate">
                          {entry.notes || '-'}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 flex-wrap">
                          {entry.status === 'pending' && entry.clock_out && (
                            <>
                              <button
                                onClick={() => approveEntry(entry.id)}
                                className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => rejectEntry(entry.id)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => startEditEntry(entry)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm flex items-center gap-1"
                          >
                            <Edit2 size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm flex items-center gap-1"
                          >
                            <Trash2 size={14} />
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
        )}
      </div>
    );
  };

  // Edit Modal Component
  const EditModal = () => {
    if (!editingEntry) return null;

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        style={{ pointerEvents: 'all' }}
        onMouseDown={(e) => {
          // Only close if clicking the backdrop itself, not the modal content
          if (e.target === e.currentTarget) {
            cancelEdit();
          }
        }}
      >
        <div 
          className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-8 relative"
          style={{ pointerEvents: 'all', zIndex: 9999 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Edit Time Entry</h2>
            <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Employee:</strong> {editingEntry.employee_name} (#{editingEntry.employee_number})
              </p>
              <p className="text-sm text-gray-600">
                <strong>Committee:</strong> {editingEntry.committee_name}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Clock In Date & Time</label>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={editClockIn.split('T')[0]}
                  onChange={(e) => {
                    const time = editClockIn.split('T')[1] || '08:00';
                    setEditClockIn(`${e.target.value}T${time}`);
                  }}
                  
                  className="flex-1 px-4 py-3 border-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <input
                  type="time"
                  value={editClockIn.split('T')[1] || '08:00'}
                  onChange={(e) => {
                    const date = editClockIn.split('T')[0];
                    setEditClockIn(`${date}T${e.target.value}`);
                  }}
                  
                  className="w-32 px-4 py-3 border-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Clock Out Date & Time</label>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={editClockOut ? editClockOut.split('T')[0] : ''}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setEditClockOut('');
                      return;
                    }
                    const time = editClockOut ? editClockOut.split('T')[1] : '17:00';
                    setEditClockOut(`${e.target.value}T${time}`);
                  }}
                  
                  className="flex-1 px-4 py-3 border-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <input
                  type="time"
                  value={editClockOut ? (editClockOut.split('T')[1] || '17:00') : ''}
                  onChange={(e) => {
                    if (!editClockOut) return;
                    const date = editClockOut.split('T')[0];
                    setEditClockOut(`${date}T${e.target.value}`);
                  }}
                  
                  className="w-32 px-4 py-3 border-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave empty if still clocked in</p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Volunteer Notes (Read-Only)
              </label>
              <textarea
                value={editNotes}
                readOnly
                className="w-full px-4 py-3 border-2 rounded-lg resize-none bg-gray-50 text-gray-700 cursor-not-allowed"
                rows="3"
                placeholder="No notes from volunteer"
              />
              <p className="text-xs text-gray-500 mt-1">
                These are the notes the volunteer wrote when clocking out
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Chair/Admin Notes (Add Your Notes Here)
              </label>
              <textarea
                ref={chairNotesRef}
                key={editingEntry?.id}
                defaultValue={editChairNotes}
                className="w-full px-4 py-3 border-2 rounded-lg resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                rows="3"
                placeholder="Add notes about this entry (corrections, approvals, etc.)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your notes will be saved separately and visible to other chairs/admin
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={saveEdit}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                Save Changes
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // RENDER: Admin Dashboard (collapsed employee/committee sections for brevity)
  if (user && userProfile && isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-2xl p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">Groton Sportsmen's Club</h1>
                <p className="text-gray-600 mt-1">Admin Dashboard</p>
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

          <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <User size={48} className="text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Logged in as:</p>
                <p className="font-semibold text-lg">{user.email}</p>
                <p className="text-sm text-indigo-600 font-semibold">Role: ADMIN</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Employee & Committee Management sections unchanged - keeping them for completeness */}
            <details className="bg-white rounded-lg shadow-xl p-6">
              <summary className="text-2xl font-bold cursor-pointer flex items-center gap-2">
                <User size={28} />
                Employee Management
              </summary>
              <div className="mt-6">
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <h3 className="font-semibold mb-4">Add New Employee</h3>
                  <div className="flex gap-4 mb-3">
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
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={newEmployeeHours}
                      onChange={(e) => setNewEmployeeHours(e.target.value)}
                      placeholder="Prior Hours (optional)"
                      className="w-52 px-4 py-3 border-2 rounded-lg text-lg"
                      title="Enter hours already worked this fiscal year (before using time clock)"
                      onKeyPress={(e) => e.key === 'Enter' && newEmployeeName && newEmployeeNumber && addEmployee()}
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={addEmployee}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
                    >
                      <Plus size={20} />
                      Add Employee
                    </button>
                    <label className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer flex items-center gap-2">
                      <Upload size={20} />
                      Import Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileImport}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    💡 <strong>Prior Hours:</strong> Enter hours already worked this fiscal year (before time clock was implemented). Will be added as approved historical hours.
                  </p>
                </div>

                {employees.length > 0 && (
                  <div className="border-2 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="p-4 text-left font-semibold">Number</th>
                          <th className="p-4 text-left font-semibold">Name</th>
                          <th className="p-4 text-left font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((emp, idx) => (
                          <tr key={emp.id} className={`border-t hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
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
            </details>

            <details className="bg-white rounded-lg shadow-xl p-6">
              <summary className="text-2xl font-bold cursor-pointer flex items-center gap-2">
                <Building2 size={28} />
                Committee Management
              </summary>
              <div className="mt-6">
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

                {committees.length > 0 && (
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
                          <tr key={com.id} className={`border-t hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            {editingCommittee === com.id ? (
                              <>
                                <td className="p-4">
                                  <input
                                    type="text"
                                    value={editCommitteeName}
                                    onChange={(e) => setEditCommitteeName(e.target.value)}
                                    className="w-full p-2 border rounded"
                                    placeholder="Committee Name"
                                  />
                                </td>
                                <td className="p-4">
                                  <input
                                    type="text"
                                    value={editCommitteeChair}
                                    onChange={(e) => setEditCommitteeChair(e.target.value)}
                                    className="w-full p-2 border rounded"
                                    placeholder="Chair Name"
                                  />
                                </td>
                                <td className="p-4">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => updateCommittee(com.id)}
                                      className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                    >
                                      <CheckCircle size={16} />
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEditCommittee}
                                      className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                    >
                                      <X size={16} />
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-4 font-semibold">{com.name}</td>
                                <td className="p-4">{com.chair}</td>
                                <td className="p-4">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => startEditCommittee(com)}
                                      className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                    >
                                      <Edit2 size={16} />
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => deleteCommittee(com.id)}
                                      className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                    >
                                      <Trash2 size={16} />
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </details>

            {/* Export Reports Section */}
            <div className="bg-white rounded-lg shadow-xl p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Download size={28} />
                Export Reports
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={exportWeeklyReports}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Current Week
                </button>

                <button
                  onClick={exportMonthlyReport}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Current Month
                </button>

                <button
                  onClick={exportQuarterlyReport}
                  className="px-6 py-3 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Current Quarter
                </button>

                <button
                  onClick={() => setShowDateRangeExport(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Calendar size={20} />
                  Custom Date Range
                </button>

                {/* Grant Report Button - Highlighted */}
                <button
                  onClick={exportGrantReport}
                  className="col-span-2 px-6 py-4 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 flex items-center justify-center gap-2 text-lg border-4 border-purple-300"
                >
                  <Download size={24} />
                  📊 GRANT REPORT (Fiscal Year)
                </button>
              </div>

              {/* Delete All Button - Hidden at bottom */}
              <div className="mt-6 pt-6 border-t-2">
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-semibold">
                    ⚠️ Danger Zone (Testing Tools)
                  </summary>
                  <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                    <p className="text-red-800 font-semibold mb-3">
                      ⚠️ Warning: This will delete ALL time entries permanently!
                    </p>
                    <button
                      onClick={deleteAllEntries}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center gap-2"
                    >
                      <Trash2 size={20} />
                      Delete All Time Entries
                    </button>
                  </div>
                </details>
              </div>

              {showDateRangeExport && (
                <div className="mt-6 p-4 border-2 rounded-lg bg-blue-50">
                  <div className="flex items-center gap-4 mb-4">
                    <h3 className="font-semibold">Export by Date Range</h3>
                    <button
                      onClick={() => setShowDateRangeExport(false)}
                      className="ml-auto text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>
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

            <TimeEntryTable />
          </div>
        </div>
        <EditModal />
      </div>
    );
  }

  // RENDER: Committee Chair Dashboard
  if (user && userProfile && isChair && chairCommittee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-2xl p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">{chairCommittee.name}</h1>
                <p className="text-gray-600 mt-1">Committee Chair Dashboard</p>
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

          <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Building2 size={48} className="text-indigo-600" />
                <div>
                  <p className="text-sm text-gray-600">Logged in as:</p>
                  <p className="font-semibold text-lg">{user.email}</p>
                  <p className="text-sm text-indigo-600 font-semibold">
                    Chair of {chairCommittee.name}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-orange-600">{pendingCount}</p>
                <p className="text-sm text-gray-600">Pending Approvals</p>
              </div>
            </div>
          </div>

          {/* Export Reports Section */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Download size={28} />
              Export Reports
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => exportCommitteeReport(chairCommittee.id)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Download size={20} />
                All Time Entries
              </button>

              <button
                onClick={exportMonthlyReport}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 flex items-center justify-center gap-2"
              >
                <Download size={20} />
                Current Month
              </button>

              <button
                onClick={exportQuarterlyReport}
                className="px-6 py-3 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 flex items-center justify-center gap-2"
              >
                <Download size={20} />
                Current Quarter
              </button>

              <button
                onClick={() => setShowDateRangeExport(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Calendar size={20} />
                Custom Date Range
              </button>
            </div>

            {showDateRangeExport && (
              <div className="mt-6 p-4 border-2 rounded-lg bg-blue-50">
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="font-semibold">Export by Date Range</h3>
                  <button
                    onClick={() => setShowDateRangeExport(false)}
                    className="ml-auto text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
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

          {/* Employee Management for Special Chairs (Membership & Work Hours) */}
          {userProfile.hasEmployeeManagement && (
            <div className="bg-white rounded-lg shadow-xl p-6 mt-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <User size={28} />
                Employee Management
              </h2>
              
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <h3 className="font-semibold mb-4">Add New Employee</h3>
                <div className="flex gap-4 mb-3">
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
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={newEmployeeHours}
                    onChange={(e) => setNewEmployeeHours(e.target.value)}
                    placeholder="Prior Hours (optional)"
                    className="w-52 px-4 py-3 border-2 rounded-lg text-lg"
                    title="Enter hours already worked this fiscal year (before using time clock)"
                    onKeyPress={(e) => e.key === 'Enter' && newEmployeeName && newEmployeeNumber && addEmployee()}
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={addEmployee}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Add Employee
                  </button>
                  <label className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer flex items-center gap-2">
                    <Upload size={20} />
                    Import Excel
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileImport}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  💡 <strong>Prior Hours:</strong> Enter hours already worked this fiscal year (before time clock was implemented). Will be added as approved historical hours.
                </p>
              </div>

              {employees.length > 0 && (
                <div className="border-2 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-4 text-left font-semibold">Number</th>
                        <th className="p-4 text-left font-semibold">Name</th>
                        <th className="p-4 text-left font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, idx) => (
                        <tr key={emp.id} className={`border-t hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
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
          )}

          <TimeEntryTable />
        </div>
        <EditModal />
      </div>
    );
  }

  // RENDER: Volunteer Screen (unchanged from Step 3/4)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
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

        {!loggedInEmployee && (
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Volunteer Time Clock</h2>
            
            <div className="space-y-6">
              <div className="relative">
                <label className="block text-lg font-semibold mb-3">
                  Enter Your Name or Employee Number
                </label>
                <input
                  type="text"
                  value={loginInput}
                  onChange={(e) => {
                    setLoginInput(e.target.value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const matches = employees.filter(emp => {
                        const input = loginInput.toLowerCase();
                        return emp.name.toLowerCase().includes(input) || 
                               (emp.number || '').toLowerCase().includes(input);
                      });
                      if (matches.length === 1) {
                        setLoggedInEmployee(matches[0]);
                        setLoginInput('');
                      } else {
                        handleVolunteerLogin();
                      }
                    }
                  }}
                  placeholder="John Smith or 101"
                  className="w-full px-6 py-4 border-2 rounded-lg text-xl focus:border-indigo-500 focus:outline-none"
                  autoFocus
                />
                
                {/* Autocomplete Dropdown */}
                {loginInput.length > 0 && (() => {
                  const matches = employees.filter(emp => {
                    const input = loginInput.toLowerCase();
                    return emp.name.toLowerCase().includes(input) || 
                           (emp.number || '').toLowerCase().includes(input);
                  }).slice(0, 5); // Show max 5 matches

                  if (matches.length > 0) {
                    return (
                      <div className="absolute z-10 w-full mt-2 bg-white border-2 border-indigo-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                        {matches.map(emp => (
                          <button
                            key={emp.id}
                            onClick={() => {
                              setLoggedInEmployee(emp);
                              setLoginInput('');
                            }}
                            className="w-full px-6 py-4 text-left hover:bg-indigo-50 border-b last:border-b-0 transition-colors"
                          >
                            <div className="font-semibold text-lg">{emp.name}</div>
                            <div className="text-sm text-gray-600">#{emp.number}</div>
                          </button>
                        ))}
                      </div>
                    );
                  }
                })()}
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

        {loggedInEmployee && !isClockedIn() && (
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2">
                Welcome, {loggedInEmployee.name}!
              </h2>
              <p className="text-gray-600">Employee #{loggedInEmployee.number}</p>
              <p className="text-sm text-indigo-600 font-semibold mt-2">
                Fiscal Year Hours: {getYTDHours(loggedInEmployee.number).toFixed(2)} (approved)
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

              {/* Photo Upload */}
              <div>
                <label className="block text-lg font-semibold mb-3">
                  Add Photo (Optional)
                </label>
                
                {!clockOutPhotoPreview ? (
                  <label className="w-full px-6 py-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 flex items-center justify-center gap-3">
                    <Upload size={24} className="text-gray-400" />
                    <span className="text-lg text-gray-600">Tap to add photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <img 
                      src={clockOutPhotoPreview} 
                      alt="Work photo" 
                      className="w-full rounded-lg border-2"
                    />
                    <button
                      onClick={removePhoto}
                      className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
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

      {user && !userProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-center mb-6">
              Admin/Chair Login
            </h2>

            {/* Committee Chair Simple Login */}
            <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <h3 className="font-semibold mb-4 text-center">Committee Chair Login</h3>
              <div className="space-y-3">
                <select
                  value={selectedCommittee}
                  onChange={(e) => setSelectedCommittee(e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-lg focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Select Your Committee...</option>
                  {committees.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  className="w-full px-4 py-3 border-2 rounded-lg focus:border-indigo-500 focus:outline-none"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && selectedCommittee && password) {
                      const committee = committees.find(c => c.id === parseInt(selectedCommittee));
                      if (committee && committee.password === password.toLowerCase()) {
                        // Check if special committee (Membership or Work Hours)
                        const specialCommittees = ['membership', 'work hours', 'workhours', 'work-hours'];
                        const isSpecialChair = specialCommittees.some(name => 
                          committee.name.toLowerCase().includes(name)
                        );
                        
                        setUserProfile({ 
                          role: 'chair', 
                          committee_id: committee.id,
                          hasEmployeeManagement: isSpecialChair
                        });
                        setPassword('');
                        setSelectedCommittee('');
                      } else {
                        alert('Incorrect password');
                        setPassword('');
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (!selectedCommittee) {
                      alert('Please select a committee');
                      return;
                    }
                    const committee = committees.find(c => c.id === parseInt(selectedCommittee));
                    if (!committee) return;
                    
                    if (committee.password === password.toLowerCase()) {
                      // Check if special committee (Membership or Work Hours)
                      const specialCommittees = ['membership', 'work hours', 'workhours', 'work-hours'];
                      const isSpecialChair = specialCommittees.some(name => 
                        committee.name.toLowerCase().includes(name)
                      );
                      
                      setUserProfile({ 
                        role: 'chair', 
                        committee_id: committee.id,
                        hasEmployeeManagement: isSpecialChair
                      });
                      setPassword('');
                      setSelectedCommittee('');
                    } else {
                      alert('Incorrect password');
                      setPassword('');
                    }
                  }}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                >
                  Login as Chair
                </button>
              </div>
            </div>

            {/* Admin Email/Password Login */}
            <div className="border-t-2 pt-6">
              <h3 className="font-semibold mb-4 text-center text-gray-700">Admin Login</h3>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 border-2 rounded-lg focus:border-indigo-500 focus:outline-none"
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
                  {loading ? 'Logging in...' : 'Login as Admin'}
                </button>
              </form>
            </div>

            <button
              type="button"
              onClick={() => {
                setUser(null);
                setPassword('');
                setSelectedCommittee('');
              }}
              className="w-full mt-4 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
