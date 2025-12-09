import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { User, LogOut, Plus, Trash2, Building2 } from 'lucide-react';

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

  // Employee state
  const [employees, setEmployees] = useState([]);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeNumber, setNewEmployeeNumber] = useState('');

  // Committee state
  const [committees, setCommittees] = useState([]);
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [newCommitteeChair, setNewCommitteeChair] = useState('');

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

  const loadUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      setUserProfile(data);
      console.log('User profile loaded:', data);
      
      if (data.role === 'admin') {
        loadEmployees();
        loadCommittees();
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');

      if (error) throw error;
      
      setEmployees(data || []);
      console.log('Employees loaded:', data?.length || 0);
    } catch (error) {
      console.error('Error loading employees:', error);
      setEmployees([]);
    }
  };

  const loadCommittees = async () => {
    try {
      const { data, error } = await supabase
        .from('committees')
        .select('*')
        .order('name');

      if (error) throw error;
      
      setCommittees(data || []);
      console.log('Committees loaded:', data?.length || 0);
    } catch (error) {
      console.error('Error loading committees:', error);
      setCommittees([]);
    }
  };

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
      loadEmployees();
      alert('✅ Employee added!');
    } catch (error) {
      console.error('Error adding employee:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const deleteEmployee = async (id) => {
    if (!confirm('Delete this employee?')) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadEmployees();
      alert('✅ Employee deleted!');
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert(`Error: ${error.message}`);
    }
  };

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
        password: '' // No longer used with auth
      });

      if (error) throw error;

      setNewCommitteeName('');
      setNewCommitteeChair('');
      loadCommittees();
      alert('✅ Committee added!');
    } catch (error) {
      console.error('Error adding committee:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const deleteCommittee = async (id) => {
    if (!confirm('Delete this committee?')) return;

    try {
      const { error } = await supabase
        .from('committees')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadCommittees();
      alert('✅ Committee deleted!');
    } catch (error) {
      console.error('Error deleting committee:', error);
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

      console.log('Login successful!', data);
    } catch (error) {
      console.error('Login error:', error);
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
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isAdmin = userProfile?.role === 'admin';

  // If logged in, show dashboard
  if (user && userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-2xl p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">Groton Sportsmen's Club</h1>
                <p className="text-gray-600 mt-1">Time Clock System - Step 2: Committee Management</p>
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
                  Role: {userProfile.role.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Admin Panel */}
          {isAdmin && (
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
                      <p className="text-sm">Add your first committee above</p>
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

                {/* Progress */}
                <div className="mt-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <p className="text-sm text-green-800">
                    ✅ <strong>Step 2 Complete:</strong> Committee management is working!<br/>
                    <strong>Next:</strong> We'll add Volunteer Clock In/Out (Step 3)
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isAdmin && (
            <div className="bg-white rounded-lg shadow-xl p-6">
              <p className="text-center text-gray-600">
                You are logged in as a {userProfile.role}.<br/>
                Management features require admin access.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Login form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-2">
          Groton Sportsmen's Club
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Time Clock System
        </p>

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
            {loading ? 'Logging in...' : 'Login as Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
