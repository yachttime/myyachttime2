import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRoleImpersonation } from '../contexts/RoleImpersonationContext';
import { Users, Plus, X, Ship, FileText, Wrench, DollarSign, Search, Edit2, Trash2, Calendar } from 'lucide-react';

interface Customer {
  id: string;
  customer_type: 'individual' | 'business';
  first_name?: string;
  last_name?: string;
  business_name?: string;
  email?: string;
  phone?: string;
  secondary_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

interface Vessel {
  id: string;
  customer_id: string;
  vessel_name: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  length_feet?: number;
  hull_number?: string;
  registration_number?: string;
  engine_make?: string;
  engine_model?: string;
  fuel_type?: string;
  notes?: string;
  is_active: boolean;
}

interface CustomerHistory {
  estimates: number;
  work_orders: number;
  invoices: number;
  repair_requests: number;
}

export default function CustomerManagement() {
  const { user, userProfile } = useAuth();
  const { getEffectiveRole } = useRoleImpersonation();
  const effectiveRole = getEffectiveRole(userProfile?.role);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddVessel, setShowAddVessel] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerVessels, setCustomerVessels] = useState<Vessel[]>([]);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistory | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showMeetingAppointment, setShowMeetingAppointment] = useState(false);
  const [meetingAppointmentLoading, setMeetingAppointmentLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [meetingForm, setMeetingForm] = useState({
    person_name: '',
    email: '',
    phone: '',
    secondary_phone: '',
    date: '',
    time: '',
    notes: '',
  });

  const [newCustomer, setNewCustomer] = useState({
    customer_type: 'individual' as 'individual' | 'business',
    first_name: '',
    last_name: '',
    business_name: '',
    email: '',
    phone: '',
    secondary_phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    notes: '',
  });

  const [newVessel, setNewVessel] = useState({
    vessel_name: '',
    manufacturer: '',
    model: '',
    year: '',
    length_feet: '',
    hull_number: '',
    registration_number: '',
    engine_make: '',
    engine_model: '',
    fuel_type: '',
    notes: '',
  });

  useEffect(() => {
    if (user) {
      loadCustomers();
    }
  }, [user]);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredCustomers(customers);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = customers.filter(c => {
        const name = c.customer_type === 'business'
          ? c.business_name?.toLowerCase() || ''
          : `${c.first_name} ${c.last_name}`.toLowerCase();
        return name.includes(term) ||
               c.email?.toLowerCase().includes(term) ||
               c.phone?.includes(term);
      });
      setFilteredCustomers(filtered);
    }
  }, [searchTerm, customers]);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
      setFilteredCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerVessels = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_vessels')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomerVessels(data || []);
    } catch (error) {
      console.error('Error loading vessels:', error);
    }
  };

  const loadCustomerHistory = async (customerId: string) => {
    try {
      const [estimates, workOrders, invoices, repairRequests] = await Promise.all([
        supabase.from('estimates').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
        supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
        supabase.from('yacht_invoices').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
        supabase.from('repair_requests').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
      ]);

      setCustomerHistory({
        estimates: estimates.count || 0,
        work_orders: workOrders.count || 0,
        invoices: invoices.count || 0,
        repair_requests: repairRequests.count || 0,
      });
    } catch (error) {
      console.error('Error loading customer history:', error);
    }
  };

  const handleAddCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          ...newCustomer,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCustomers([data, ...customers]);
      setShowAddCustomer(false);
      setNewCustomer({
        customer_type: 'individual',
        first_name: '',
        last_name: '',
        business_name: '',
        email: '',
        phone: '',
        secondary_phone: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        zip_code: '',
        notes: '',
      });
      setSuccessMessage('Customer added successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error adding customer:', error);
      setErrorMessage('Failed to add customer');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return;

    try {
      const { error } = await supabase
        .from('customers')
        .update(editingCustomer)
        .eq('id', editingCustomer.id);

      if (error) throw error;

      setCustomers(customers.map(c => c.id === editingCustomer.id ? editingCustomer : c));
      if (selectedCustomer?.id === editingCustomer.id) {
        setSelectedCustomer(editingCustomer);
      }
      setEditingCustomer(null);
      setSuccessMessage('Customer updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating customer:', error);
      setErrorMessage('Failed to update customer');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleAddVessel = async () => {
    if (!selectedCustomer) return;

    try {
      const { data, error } = await supabase
        .from('customer_vessels')
        .insert({
          customer_id: selectedCustomer.id,
          vessel_name: newVessel.vessel_name,
          manufacturer: newVessel.manufacturer || null,
          model: newVessel.model || null,
          year: newVessel.year ? parseInt(newVessel.year) : null,
          length_feet: newVessel.length_feet ? parseInt(newVessel.length_feet) : null,
          hull_number: newVessel.hull_number || null,
          registration_number: newVessel.registration_number || null,
          engine_make: newVessel.engine_make || null,
          engine_model: newVessel.engine_model || null,
          fuel_type: newVessel.fuel_type || null,
          notes: newVessel.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      setCustomerVessels([data, ...customerVessels]);
      setShowAddVessel(false);
      setNewVessel({
        vessel_name: '',
        manufacturer: '',
        model: '',
        year: '',
        length_feet: '',
        hull_number: '',
        registration_number: '',
        engine_make: '',
        engine_model: '',
        fuel_type: '',
        notes: '',
      });
      setSuccessMessage('Vessel added successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error adding vessel:', error);
      setErrorMessage('Failed to add vessel');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    loadCustomerVessels(customer.id);
    loadCustomerHistory(customer.id);
  };

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.customer_type === 'business') {
      return customer.business_name || 'Unnamed Business';
    }
    return `${customer.first_name} ${customer.last_name}`;
  };

  const handleMeetingAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setMeetingAppointmentLoading(true);

    try {
      const appointmentData = {
        date: meetingForm.date,
        time: meetingForm.time,
        customer_name: meetingForm.person_name,
        customer_email: meetingForm.email || null,
        customer_phone: meetingForm.phone || null,
        notes: meetingForm.notes || null,
        yacht_name: null,
        created_by: user.id
      };

      const { error } = await supabase
        .from('appointments')
        .insert(appointmentData);

      if (error) throw error;

      setSuccessMessage('Meeting appointment created successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowMeetingAppointment(false);
      setMeetingForm({
        person_name: '',
        email: '',
        phone: '',
        secondary_phone: '',
        date: '',
        time: '',
        notes: '',
      });
    } catch (error) {
      console.error('Error creating meeting appointment:', error);
      setErrorMessage('Failed to create meeting appointment');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setMeetingAppointmentLoading(false);
    }
  };

  if (!userProfile || !effectiveRole || !['staff', 'mechanic', 'master', 'manager'].includes(effectiveRole)) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Access denied. Staff only.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 font-medium">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium">
          {errorMessage}
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMeetingAppointment(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Calendar className="w-5 h-5" />
              Meeting Appointment
            </button>
            <button
              onClick={() => setShowAddCustomer(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Customer
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              onClick={() => handleSelectCustomer(customer)}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedCustomer?.id === customer.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{getCustomerDisplayName(customer)}</h3>
                  <p className="text-sm text-gray-600 capitalize">{customer.customer_type}</p>
                  {customer.email && (
                    <p className="text-sm text-gray-500 mt-1">{customer.email}</p>
                  )}
                  {customer.phone && (
                    <p className="text-sm text-gray-500">{customer.phone}</p>
                  )}
                </div>
                {!customer.is_active && (
                  <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="text-center py-8 text-gray-700 font-medium">
              No customers found
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedCustomer ? (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {getCustomerDisplayName(selectedCustomer)}
                  </h2>
                  <button
                    onClick={() => setEditingCustomer(selectedCustomer)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Type</p>
                    <p className="font-medium capitalize text-gray-900">{selectedCustomer.customer_type}</p>
                  </div>
                  {selectedCustomer.email && (
                    <div>
                      <p className="text-gray-600">Email</p>
                      <p className="font-medium text-gray-900">{selectedCustomer.email}</p>
                    </div>
                  )}
                  {selectedCustomer.phone && (
                    <div>
                      <p className="text-gray-600">Phone</p>
                      <p className="font-medium text-gray-900">{selectedCustomer.phone}</p>
                    </div>
                  )}
                  {selectedCustomer.secondary_phone && (
                    <div>
                      <p className="text-gray-600">Secondary Phone</p>
                      <p className="font-medium text-gray-900">{selectedCustomer.secondary_phone}</p>
                    </div>
                  )}
                  {(selectedCustomer.address_line1 || selectedCustomer.city) && (
                    <div className="col-span-2">
                      <p className="text-gray-600">Address</p>
                      <p className="font-medium text-gray-900">
                        {selectedCustomer.address_line1}
                        {selectedCustomer.address_line2 && `, ${selectedCustomer.address_line2}`}
                        <br />
                        {selectedCustomer.city && `${selectedCustomer.city}, `}
                        {selectedCustomer.state} {selectedCustomer.zip_code}
                      </p>
                    </div>
                  )}
                  {selectedCustomer.notes && (
                    <div className="col-span-2">
                      <p className="text-gray-600">Notes</p>
                      <p className="font-medium text-gray-900">{selectedCustomer.notes}</p>
                    </div>
                  )}
                </div>

                {customerHistory && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3">Activity Summary</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <FileText className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-gray-900">{customerHistory.estimates}</p>
                        <p className="text-xs text-gray-600">Estimates</p>
                      </div>
                      <div className="text-center">
                        <Wrench className="w-6 h-6 text-green-600 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-gray-900">{customerHistory.work_orders}</p>
                        <p className="text-xs text-gray-600">Work Orders</p>
                      </div>
                      <div className="text-center">
                        <DollarSign className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-gray-900">{customerHistory.invoices}</p>
                        <p className="text-xs text-gray-600">Invoices</p>
                      </div>
                      <div className="text-center">
                        <Wrench className="w-6 h-6 text-red-600 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-gray-900">{customerHistory.repair_requests}</p>
                        <p className="text-xs text-gray-600">Repairs</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Ship className="w-6 h-6 text-blue-600" />
                    <h3 className="text-xl font-bold text-gray-900">Vessels</h3>
                  </div>
                  <button
                    onClick={() => setShowAddVessel(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Vessel
                  </button>
                </div>

                <div className="space-y-3">
                  {customerVessels.map((vessel) => (
                    <div key={vessel.id} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900">{vessel.vessel_name}</h4>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                        {vessel.manufacturer && (
                          <div>
                            <span className="text-gray-600">Make: </span>
                            <span className="font-medium text-gray-900">{vessel.manufacturer}</span>
                          </div>
                        )}
                        {vessel.model && (
                          <div>
                            <span className="text-gray-600">Model: </span>
                            <span className="font-medium text-gray-900">{vessel.model}</span>
                          </div>
                        )}
                        {vessel.year && (
                          <div>
                            <span className="text-gray-600">Year: </span>
                            <span className="font-medium text-gray-900">{vessel.year}</span>
                          </div>
                        )}
                        {vessel.length_feet && (
                          <div>
                            <span className="text-gray-600">Length: </span>
                            <span className="font-medium text-gray-900">{vessel.length_feet} ft</span>
                          </div>
                        )}
                        {vessel.hull_number && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Hull #: </span>
                            <span className="font-medium text-gray-900">{vessel.hull_number}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {customerVessels.length === 0 && (
                    <p className="text-center text-gray-700 py-4 font-medium">No vessels added</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700 text-lg font-medium">Select a customer to view details</p>
            </div>
          )}
        </div>
      </div>

      {showAddCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Add New Customer</h2>
              <button onClick={() => setShowAddCustomer(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="individual"
                      checked={newCustomer.customer_type === 'individual'}
                      onChange={(e) => setNewCustomer({ ...newCustomer, customer_type: e.target.value as 'individual' })}
                      className="mr-2"
                    />
                    Individual
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="business"
                      checked={newCustomer.customer_type === 'business'}
                      onChange={(e) => setNewCustomer({ ...newCustomer, customer_type: e.target.value as 'business' })}
                      className="mr-2"
                    />
                    Business
                  </label>
                </div>
              </div>

              {newCustomer.customer_type === 'individual' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={newCustomer.first_name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={newCustomer.last_name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                  <input
                    type="text"
                    value={newCustomer.business_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, business_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Phone</label>
                <input
                  type="tel"
                  value={newCustomer.secondary_phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, secondary_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={newCustomer.address_line1}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address_line1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={newCustomer.address_line2}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address_line2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={newCustomer.city}
                    onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={newCustomer.state}
                    onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={newCustomer.zip_code}
                    onChange={(e) => setNewCustomer({ ...newCustomer, zip_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowAddCustomer(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustomer}
                  disabled={
                    (newCustomer.customer_type === 'individual' && (!newCustomer.first_name || !newCustomer.last_name)) ||
                    (newCustomer.customer_type === 'business' && !newCustomer.business_name)
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddVessel && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Add Vessel</h2>
              <button onClick={() => setShowAddVessel(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vessel Name *</label>
                <input
                  type="text"
                  value={newVessel.vessel_name}
                  onChange={(e) => setNewVessel({ ...newVessel, vessel_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={newVessel.manufacturer}
                    onChange={(e) => setNewVessel({ ...newVessel, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={newVessel.model}
                    onChange={(e) => setNewVessel({ ...newVessel, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={newVessel.year}
                    onChange={(e) => setNewVessel({ ...newVessel, year: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Length (feet)</label>
                  <input
                    type="number"
                    value={newVessel.length_feet}
                    onChange={(e) => setNewVessel({ ...newVessel, length_feet: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hull Number</label>
                <input
                  type="text"
                  value={newVessel.hull_number}
                  onChange={(e) => setNewVessel({ ...newVessel, hull_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input
                  type="text"
                  value={newVessel.registration_number}
                  onChange={(e) => setNewVessel({ ...newVessel, registration_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Engine Make</label>
                  <input
                    type="text"
                    value={newVessel.engine_make}
                    onChange={(e) => setNewVessel({ ...newVessel, engine_make: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Engine Model</label>
                  <input
                    type="text"
                    value={newVessel.engine_model}
                    onChange={(e) => setNewVessel({ ...newVessel, engine_model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                <select
                  value={newVessel.fuel_type}
                  onChange={(e) => setNewVessel({ ...newVessel, fuel_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  <option value="">Select...</option>
                  <option value="gasoline">Gasoline</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newVessel.notes}
                  onChange={(e) => setNewVessel({ ...newVessel, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowAddVessel(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddVessel}
                  disabled={!newVessel.vessel_name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Vessel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Edit Customer</h2>
              <button onClick={() => setEditingCustomer(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {editingCustomer.customer_type === 'individual' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={editingCustomer.first_name || ''}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={editingCustomer.last_name || ''}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                  <input
                    type="text"
                    value={editingCustomer.business_name || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, business_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editingCustomer.email || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editingCustomer.phone || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Phone</label>
                <input
                  type="tel"
                  value={editingCustomer.secondary_phone || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, secondary_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={editingCustomer.address_line1 || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, address_line1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={editingCustomer.address_line2 || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, address_line2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editingCustomer.city || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={editingCustomer.state || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={editingCustomer.zip_code || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, zip_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editingCustomer.notes || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingCustomer.is_active}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Customer</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateCustomer}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMeetingAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-7 h-7 text-teal-600" />
                <h2 className="text-2xl font-bold text-gray-900">Schedule Meeting with Potential Client</h2>
              </div>
              <button onClick={() => setShowMeetingAppointment(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleMeetingAppointmentSubmit} className="p-6 space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700">
                  Schedule a meeting with a potential client who doesn't have a yacht yet. This creates an appointment without requiring yacht information.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Person Name *</label>
                <input
                  type="text"
                  value={meetingForm.person_name}
                  onChange={(e) => setMeetingForm({ ...meetingForm, person_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  required
                  placeholder="John Doe or Company Name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={meetingForm.email}
                    onChange={(e) => setMeetingForm({ ...meetingForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={meetingForm.phone}
                    onChange={(e) => setMeetingForm({ ...meetingForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    required
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Phone</label>
                <input
                  type="tel"
                  value={meetingForm.secondary_phone}
                  onChange={(e) => setMeetingForm({ ...meetingForm, secondary_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="(555) 987-6543"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Date *</label>
                  <input
                    type="date"
                    value={meetingForm.date}
                    onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 [color-scheme:light]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Time *</label>
                  <input
                    type="time"
                    value={meetingForm.time}
                    onChange={(e) => setMeetingForm({ ...meetingForm, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 [color-scheme:light]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Notes</label>
                <textarea
                  value={meetingForm.notes}
                  onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Purpose of meeting, topics to discuss, etc."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowMeetingAppointment(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                  disabled={meetingAppointmentLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={meetingAppointmentLoading}
                >
                  {meetingAppointmentLoading ? 'Scheduling...' : 'Schedule Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
