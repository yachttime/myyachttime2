import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  Ship,
  User,
  Package,
  X,
  Calendar,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRoleImpersonation } from '../contexts/RoleImpersonationContext';
import { isMasterRole, isManagerRole } from '../lib/supabase';

interface DailyTask {
  id: string;
  title: string;
  assigned_to: string;
  assigned_by: string;
  yacht_id: string | null;
  customer_id: string | null;
  admin_notes: string;
  staff_notes: string;
  time_spent_minutes: number;
  is_completed: boolean;
  completed_at: string | null;
  task_date: string;
  task_type: string;
  appointment_id: string | null;
  created_at: string;
  assigned_to_profile?: { first_name: string | null; last_name: string | null };
  assigned_by_profile?: { first_name: string | null; last_name: string | null };
  yachts?: { name: string; marina_slip: string | null } | null;
  customers?: { first_name: string | null; last_name: string | null; business_name: string | null; customer_type: string; customer_vessels?: { vessel_name: string | null }[] } | null;
  daily_task_parts?: DailyTaskPart[];
  appointments?: { name: string | null; date: string | null; time: string | null; problem_description: string | null; appointment_type: string | null } | null;
}

interface DailyTaskPart {
  id: string;
  task_id: string;
  part_name: string;
  quantity: string;
  notes: string;
  added_by: string;
}

interface StaffOption {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

interface YachtOption {
  id: string;
  name: string;
}

interface CustomerOption {
  id: string;
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
}

interface NewTaskForm {
  title: string;
  assigned_to: string;
  yacht_id: string;
  customer_id: string;
  admin_notes: string;
  task_date: string;
}

interface NewTaskPart {
  part_name: string;
  quantity: string;
  notes: string;
}

interface NewPartForm {
  part_name: string;
  quantity: string;
  notes: string;
}

export function DailyTasksView() {
  const { user, userProfile } = useAuth();
  const { getEffectiveRole } = useRoleImpersonation();

  const effectiveRole = getEffectiveRole(userProfile?.role);
  const canSeeAllTasks = isManagerRole(effectiveRole) || effectiveRole === 'staff' || effectiveRole === 'mechanic';
  const canManage = isManagerRole(effectiveRole);

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedCompletedId, setExpandedCompletedId] = useState<string | null>(null);
  const [showCompletedSection, setShowCompletedSection] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [yachtOptions, setYachtOptions] = useState<YachtOption[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newTask, setNewTask] = useState<NewTaskForm>({
    title: '',
    assigned_to: '',
    yacht_id: '',
    customer_id: '',
    admin_notes: '',
    task_date: new Date().toISOString().split('T')[0],
  });
  const [modalParts, setModalParts] = useState<NewTaskPart[]>([]);
  const [modalPartDraft, setModalPartDraft] = useState<NewTaskPart>({ part_name: '', quantity: '', notes: '' });
  const [showModalPartForm, setShowModalPartForm] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  const [staffNotesEdit, setStaffNotesEdit] = useState<Record<string, string>>({});
  const [timeSpentEdit, setTimeSpentEdit] = useState<Record<string, string>>({});
  const [taskDateEdit, setTaskDateEdit] = useState<Record<string, string>>({});
  const [assignedToEdit, setAssignedToEdit] = useState<Record<string, string>>({});
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  const [addingPartForTask, setAddingPartForTask] = useState<string | null>(null);
  const [newPart, setNewPart] = useState<NewPartForm>({ part_name: '', quantity: '', notes: '' });
  const [savingPart, setSavingPart] = useState(false);
  const [deletingPartId, setDeletingPartId] = useState<string | null>(null);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDate, setPrintDate] = useState(new Date().toISOString().split('T')[0]);
  const [printStaffFilter, setPrintStaffFilter] = useState<string>('all');
  const [printTasks, setPrintTasks] = useState<DailyTask[]>([]);
  const [loadingPrint, setLoadingPrint] = useState(false);
  const taskSelectFragment = `
    *,
    assigned_to_profile:user_profiles!daily_tasks_assigned_to_fkey(first_name, last_name),
    assigned_by_profile:user_profiles!daily_tasks_assigned_by_fkey(first_name, last_name),
    yachts(name, marina_slip),
    customers(first_name, last_name, business_name, customer_type, customer_vessels(vessel_name)),
    daily_task_parts(id, task_id, part_name, quantity, notes, added_by),
    appointments(name, date, time, problem_description, appointment_type)
  `;

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const activeQuery = supabase
      .from('daily_tasks')
      .select(taskSelectFragment)
      .eq('is_completed', false)
      .order('task_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (!canSeeAllTasks) {
      activeQuery.eq('assigned_to', user.id);
    }

    const completedQuery = supabase
      .from('daily_tasks')
      .select(taskSelectFragment)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(50);

    if (!canSeeAllTasks) {
      completedQuery.eq('assigned_to', user.id);
    }

    const [activeRes, completedRes] = await Promise.all([activeQuery, completedQuery]);

    if (activeRes.error) {
      setError('Failed to load tasks.');
    } else {
      setTasks(activeRes.data || []);
      const initial: Record<string, string> = {};
      const initialTime: Record<string, string> = {};
      (activeRes.data || []).forEach((t: DailyTask) => {
        initial[t.id] = t.staff_notes || '';
        initialTime[t.id] = t.time_spent_minutes > 0
          ? String(Math.floor(t.time_spent_minutes / 60) * 60 === t.time_spent_minutes
              ? t.time_spent_minutes / 60
              : (t.time_spent_minutes / 60).toFixed(2))
          : '';
      });
      setStaffNotesEdit(initial);
      setTimeSpentEdit(initialTime);
    }

    if (!completedRes.error) {
      setCompletedTasks(completedRes.data || []);
    }

    setLoading(false);
  }, [user, canManage]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (canManage) loadDropdownOptions();
  }, [canManage]);

  useEffect(() => {
    if (showCreateModal || expandedTaskId) {
      loadDropdownOptions();
    }
  }, [showCreateModal, expandedTaskId]);

  const loadDropdownOptions = async () => {
    const [staffRes, yachtRes, customerRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('user_id, first_name, last_name')
        .in('role', ['staff', 'mechanic', 'master'])
        .eq('is_active', true)
        .order('last_name'),
      supabase
        .from('yachts')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('customers')
        .select('id, customer_type, first_name, last_name, business_name')
        .eq('is_active', true)
        .order('last_name'),
    ]);
    if (staffRes.data) setStaffOptions(staffRes.data);
    if (yachtRes.data) setYachtOptions(yachtRes.data);
    if (customerRes.data) setCustomerOptions(customerRes.data);
  };

  const customerDisplayName = (c: CustomerOption) => {
    if (c.customer_type === 'business') return c.business_name || 'Unnamed Business';
    return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed Customer';
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;
    setCreatingTask(true);
    setError(null);

    const { data: taskData, error: insertError } = await supabase
      .from('daily_tasks')
      .insert({
        title: newTask.title.trim(),
        assigned_to: newTask.assigned_to || null,
        assigned_by: user!.id,
        yacht_id: newTask.yacht_id || null,
        customer_id: newTask.customer_id || null,
        admin_notes: newTask.admin_notes.trim(),
        staff_notes: '',
        time_spent_minutes: 0,
        is_completed: false,
        task_date: newTask.task_date || new Date().toISOString().split('T')[0],
        company_id: userProfile?.company_id,
      })
      .select('id')
      .single();

    if (insertError || !taskData) {
      setError('Failed to create task.');
    } else {
      if (modalParts.length > 0) {
        await supabase.from('daily_task_parts').insert(
          modalParts.map((p) => ({
            task_id: taskData.id,
            part_name: p.part_name.trim(),
            quantity: p.quantity.trim(),
            notes: p.notes.trim(),
            added_by: user!.id,
            company_id: userProfile?.company_id,
          }))
        );
      }
      setShowCreateModal(false);
      setNewTask({ title: '', assigned_to: '', yacht_id: '', customer_id: '', admin_notes: '', task_date: new Date().toISOString().split('T')[0] });
      setModalParts([]);
      setModalPartDraft({ part_name: '', quantity: '', notes: '' });
      setShowModalPartForm(false);
      await loadTasks();
    }
    setCreatingTask(false);
  };

  const handleSaveStaffUpdates = async (taskId: string) => {
    setSavingTaskId(taskId);
    const notes = staffNotesEdit[taskId] ?? '';
    const hoursStr = timeSpentEdit[taskId] ?? '0';
    const hours = parseFloat(hoursStr) || 0;
    const minutes = Math.round(hours * 60);
    const task = tasks.find((t) => t.id === taskId);
    const dateVal = taskDateEdit[taskId] ?? task?.task_date;

    const { error: updateError } = await supabase
      .from('daily_tasks')
      .update({ staff_notes: notes, time_spent_minutes: minutes, ...(dateVal ? { task_date: dateVal } : {}) })
      .eq('id', taskId);

    if (updateError) setError('Failed to save updates.');
    else await loadTasks();
    setSavingTaskId(null);
  };

  const handleMarkIncomplete = async (taskId: string) => {
    setSavingTaskId(taskId);
    const { error: updateError } = await supabase
      .from('daily_tasks')
      .update({
        is_completed: false,
        completed_at: null,
      })
      .eq('id', taskId);

    if (updateError) setError('Failed to reopen task.');
    else {
      setExpandedCompletedId(null);
      await loadTasks();
    }
    setSavingTaskId(null);
  };

  const handleMarkComplete = async (taskId: string) => {
    setSavingTaskId(taskId);
    const notes = staffNotesEdit[taskId] ?? '';
    const hoursStr = timeSpentEdit[taskId] ?? '0';
    const hours = parseFloat(hoursStr) || 0;
    const minutes = Math.round(hours * 60);

    const { error: updateError } = await supabase
      .from('daily_tasks')
      .update({
        staff_notes: notes,
        time_spent_minutes: minutes,
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateError) setError('Failed to mark task complete.');
    else {
      setExpandedTaskId(null);
      await loadTasks();
    }
    setSavingTaskId(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    setDeletingTaskId(taskId);
    const { error: deleteError } = await supabase.from('daily_tasks').delete().eq('id', taskId);
    if (deleteError) setError('Failed to delete task.');
    else await loadTasks();
    setDeletingTaskId(null);
  };

  const handleAssignTask = async (taskId: string) => {
    setAssigningTaskId(taskId);
    const newAssignee = assignedToEdit[taskId] ?? '';
    const updatePayload: Record<string, string | null> = { assigned_to: newAssignee || null };
    const { error: updateError, data: updatedRows } = await supabase
      .from('daily_tasks')
      .update(updatePayload)
      .eq('id', taskId)
      .select('id, assigned_to');
    if (updateError) {
      setError(`Failed to assign task: ${updateError.message}`);
    } else if (!updatedRows || updatedRows.length === 0) {
      setError('Assignment not saved — you may not have permission to update this task.');
    } else {
      await loadTasks();
    }
    setAssigningTaskId(null);
  };

  const handleAddPart = async (taskId: string) => {
    if (!newPart.part_name.trim()) return;
    setSavingPart(true);
    const { error: insertError } = await supabase.from('daily_task_parts').insert({
      task_id: taskId,
      part_name: newPart.part_name.trim(),
      quantity: newPart.quantity.trim(),
      notes: newPart.notes.trim(),
      added_by: user!.id,
      company_id: userProfile?.company_id,
    });
    if (insertError) setError('Failed to add part.');
    else {
      setNewPart({ part_name: '', quantity: '', notes: '' });
      setAddingPartForTask(null);
      await loadTasks();
    }
    setSavingPart(false);
  };

  const handleDeletePart = async (partId: string) => {
    setDeletingPartId(partId);
    const { error: deleteError } = await supabase.from('daily_task_parts').delete().eq('id', partId);
    if (deleteError) setError('Failed to delete part.');
    else await loadTasks();
    setDeletingPartId(null);
  };

  const loadPrintTasks = async (date: string) => {
    setLoadingPrint(true);
    const { data } = await supabase
      .from('daily_tasks')
      .select(taskSelectFragment)
      .eq('task_date', date)
      .order('created_at', { ascending: true });
    setPrintTasks(data || []);
    setLoadingPrint(false);
  };

  const handleOpenPrint = () => {
    setShowPrintModal(true);
    loadPrintTasks(printDate);
    if (staffOptions.length === 0) loadDropdownOptions();
  };

  const handlePrintDateChange = (d: string) => {
    setPrintDate(d);
    loadPrintTasks(d);
  };

  const buildPrintHTML = (tasks: DailyTask[], date: string, staffFilter: string) => {
    const filtered = staffFilter === 'all' ? tasks : tasks.filter((t) => t.assigned_to === staffFilter);
    const grouped: Record<string, DailyTask[]> = {};
    filtered.forEach((t) => {
      const key = t.assigned_to || 'unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });
    const today = new Date().toISOString().split('T')[0];
    const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    let html = `<h1 style="font-size:22px;font-weight:700;margin-bottom:2px;">Daily Tasks</h1>
<p style="font-size:13px;color:#555;margin-bottom:24px;">${dateLabel}</p>`;

    for (const [staffId, staffTasks] of Object.entries(grouped)) {
      const profile = staffTasks[0]?.assigned_to_profile;
      const name = staffId === 'unassigned' ? 'Unassigned' : ([profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Unknown');
      html += `<div style="margin-bottom:32px;">
  <div style="font-size:16px;font-weight:700;padding:8px 12px;background:#1e293b;color:#fff;border-radius:6px;margin-bottom:12px;">${name}</div>`;
      staffTasks.forEach((t, i) => {
        const isCompleted = t.is_completed;
        const isOverdue = !isCompleted && t.task_date < today;
        const statusColor = isCompleted ? '#166534' : isOverdue ? '#991b1b' : '#854d0e';
        const statusBg = isCompleted ? '#dcfce7' : isOverdue ? '#fee2e2' : '#fef9c3';
        const statusBorder = isCompleted ? '#86efac' : isOverdue ? '#fca5a5' : '#fde047';
        const statusLabel = isCompleted ? 'Completed' : isOverdue ? 'Overdue' : 'Open';
        const customerName = t.customers
          ? (t.customers.customer_type === 'business'
            ? t.customers.business_name
            : [t.customers.first_name, t.customers.last_name].filter(Boolean).join(' '))
          : null;
        html += `<div style="border:1.5px solid #d1d5db;border-radius:8px;padding:12px 14px;margin-bottom:10px;page-break-inside:avoid;background:#fff;">
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px;">
      <span style="display:inline-block;min-width:16px;height:16px;border:2px solid #374151;border-radius:3px;margin-top:1px;flex-shrink:0;"></span>
      <span style="font-size:14px;font-weight:700;flex:1;">${t.title}</span>
      <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${statusBg};color:${statusColor};border:1px solid ${statusBorder};white-space:nowrap;">${statusLabel}</span>
    </div>`;
        const customerVesselName = t.customers?.customer_vessels?.[0]?.vessel_name ?? null;
        const vesselDisplay = t.yachts
          ? t.yachts.name + (t.yachts.marina_slip ? ` — Slip: ${t.yachts.marina_slip}` : '')
          : customerVesselName ?? null;
        if (vesselDisplay || customerName || t.appointments) {
          html += `<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;margin-left:26px;margin-bottom:4px;">`;
          if (vesselDisplay) html += `<span style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;padding:2px 8px;color:#1d4ed8;font-weight:700;">&#9875; ${vesselDisplay}</span>`;
          if (customerName) html += `<span style="color:#555;"><strong style="color:#374151;">Customer:</strong> ${customerName}</span>`;
          if (t.appointments) html += `<span style="color:#555;"><strong style="color:#374151;">Appointment:</strong> ${t.appointments.name}</span>`;
          html += `</div>`;
        }
        if (t.admin_notes) {
          html += `<div style="margin-top:6px;margin-left:26px;font-size:11px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:6px 8px;white-space:pre-wrap;"><strong>Notes:</strong> ${t.admin_notes}</div>`;
        }
        if ((t.daily_task_parts ?? []).length > 0) {
          html += `<div style="margin-top:8px;margin-left:26px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:4px;">Parts</div>`;
          (t.daily_task_parts ?? []).forEach((p) => {
            html += `<div style="display:flex;gap:8px;font-size:11px;padding:3px 0;border-bottom:1px solid #f0f0f0;">
        <span>${p.part_name}</span>${p.quantity ? `<span style="color:#555;">Qty: ${p.quantity}</span>` : ''}${p.notes ? `<span style="color:#888;">— ${p.notes}</span>` : ''}
      </div>`;
          });
          html += `</div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    }
    return html;
  };

  const handlePrint = () => {
    const html = buildPrintHTML(printTasks, printDate, printStaffFilter);
    const fullHtml = `<!DOCTYPE html><html><head><title>Daily Tasks</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 28px; }
        @media print { body { padding: 16px; } }
      </style></head><body>${html}</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(fullHtml);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  const formatTaskDate = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isOverdue = (task: DailyTask) => {
    const today = new Date().toISOString().split('T')[0];
    return task.task_date < today && !task.is_completed;
  };

  const formatAppointmentTime = (time: string | null) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const display = hour % 12 || 12;
    return `${display}:${m} ${ampm}`;
  };

  const formatTimeSpent = (minutes: number) => {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatCompletedAt = (iso: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Daily Tasks</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {canManage
              ? 'Assign and track daily tasks for staff members'
              : 'Your assigned tasks — incomplete tasks carry over each day'}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenPrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium text-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Tasks
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No active tasks</p>
          <p className="text-gray-400 text-sm mt-1">
            {canManage ? 'Create a task to assign work to staff members.' : 'You have no tasks assigned to you right now.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const overdue = isOverdue(task);
            const isExpanded = expandedTaskId === task.id;
            const assigneeName = task.assigned_to
              ? ([task.assigned_to_profile?.first_name, task.assigned_to_profile?.last_name].filter(Boolean).join(' ') || 'Unknown')
              : 'Unassigned';
            const assignerName = [task.assigned_by_profile?.first_name, task.assigned_by_profile?.last_name].filter(Boolean).join(' ') || 'Unknown';
            const timeFormatted = formatTimeSpent(task.time_spent_minutes);

            return (
              <div
                key={task.id}
                className={`bg-slate-700 rounded-xl border transition-all ${
                  overdue ? 'border-orange-400 shadow-sm' : 'border-slate-600'
                }`}
              >
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer select-none"
                  onClick={() => {
                    if (isExpanded) {
                      setAssignedToEdit((p) => {
                        const next = { ...p };
                        delete next[task.id];
                        return next;
                      });
                    }
                    setExpandedTaskId(isExpanded ? null : task.id);
                  }}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <Circle className="w-5 h-5 text-gray-300" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-white text-sm">{task.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {overdue && (
                          <span className="text-xs font-medium px-2 py-0.5 bg-orange-500 text-white rounded-full">
                            Overdue
                          </span>
                        )}
                        {timeFormatted && (
                          <span className="flex items-center gap-1 text-xs text-slate-300">
                            <Clock className="w-3 h-3" />
                            {timeFormatted}
                          </span>
                        )}
                        {!isExpanded && !canManage && (
                          <span className="text-xs text-amber-400 font-medium">Tap to update</span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-300" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      {canManage && (
                        <span className={`flex items-center gap-1 text-xs ${task.assigned_to ? 'text-slate-300' : 'text-orange-400 font-medium'}`}>
                          <User className="w-3 h-3" />
                          {assigneeName}
                        </span>
                      )}
                      {task.task_type === 'appointment' && task.appointments && (
                        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded-full border border-teal-500/30">
                          <Calendar className="w-3 h-3" />
                          {task.appointments.appointment_type === 'staff' ? 'Staff Meeting' : 'Appointment'}
                          {task.appointments.time ? ` @ ${formatAppointmentTime(task.appointments.time)}` : ''}
                        </span>
                      )}
                      {task.yachts && (
                        <span className="flex items-center gap-1 text-xs text-blue-300">
                          <Ship className="w-3 h-3" />
                          {task.yachts.name}
                        </span>
                      )}
                      {task.customers && (
                        <span className="flex items-center gap-1 text-xs text-green-300">
                          <User className="w-3 h-3" />
                          {task.customers.customer_type === 'business'
                            ? task.customers.business_name
                            : [task.customers.first_name, task.customers.last_name].filter(Boolean).join(' ')}
                          {task.yachts ? (
                            <span className="text-blue-300 ml-0.5">— {task.yachts.name}</span>
                          ) : task.customers.customer_vessels && task.customers.customer_vessels.length > 0 && task.customers.customer_vessels[0].vessel_name ? (
                            <span className="text-blue-300 ml-0.5">— {task.customers.customer_vessels[0].vessel_name}</span>
                          ) : null}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {formatTaskDate(task.task_date)}
                      </span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-600 p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-300">
                      {canManage && (
                        <span>
                          <span className="font-medium text-slate-100">Assigned to:</span>{' '}
                          <span className={task.assigned_to ? '' : 'text-orange-400 font-medium'}>{assigneeName}</span>
                        </span>
                      )}
                      <span><span className="font-medium text-slate-100">Assigned by:</span> {assignerName}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-slate-100">Date:</span>
                        {canManage ? (
                          <input
                            type="date"
                            value={taskDateEdit[task.id] ?? task.task_date}
                            onChange={(e) => setTaskDateEdit((p) => ({ ...p, [task.id]: e.target.value }))}
                            className="bg-slate-700 border border-slate-500 rounded px-2 py-0.5 text-sm text-slate-100 focus:outline-none focus:border-blue-400"
                          />
                        ) : (
                          formatTaskDate(task.task_date)
                        )}
                      </span>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-2 bg-slate-600/50 border border-slate-500 rounded-lg px-3 py-2">
                        <User className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        <span className="text-sm text-slate-300 font-medium whitespace-nowrap">Assign to:</span>
                        <select
                          value={assignedToEdit[task.id] !== undefined ? assignedToEdit[task.id] : (task.assigned_to || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAssignedToEdit((p) => ({ ...p, [task.id]: val }));
                          }}
                          autoComplete="off"
                          className="flex-1 bg-slate-700 border border-slate-500 rounded-lg px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-amber-400 min-w-0"
                        >
                          <option value="">Unassigned</option>
                          {staffOptions.map((s) => (
                            <option key={s.user_id} value={s.user_id}>
                              {[s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unknown'}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignTask(task.id)}
                          disabled={
                            assigningTaskId === task.id ||
                            assignedToEdit[task.id] === undefined ||
                            assignedToEdit[task.id] === (task.assigned_to || '')
                          }
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0"
                        >
                          {assigningTaskId === task.id ? 'Saving...' : 'Assign'}
                        </button>
                      </div>
                    )}

                    {task.task_type === 'appointment' && task.appointments && (
                      <div className="bg-teal-900/30 border border-teal-600/40 rounded-lg p-3">
                        <p className="text-xs font-semibold text-teal-300 uppercase tracking-wide mb-2">
                          {task.appointments.appointment_type === 'staff' ? 'Staff Meeting Details' : 'Appointment Details'}
                        </p>
                        <div className="space-y-1 text-sm text-teal-100">
                          {task.appointments.name && (
                            <p><span className="text-teal-400 font-medium">Customer:</span> {task.appointments.name}</p>
                          )}
                          {task.appointments.date && (
                            <p><span className="text-teal-400 font-medium">Date:</span> {new Date(task.appointments.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          )}
                          {task.appointments.time && (
                            <p><span className="text-teal-400 font-medium">Time:</span> {formatAppointmentTime(task.appointments.time)}</p>
                          )}
                          {task.appointments.problem_description && (
                            <p><span className="text-teal-400 font-medium">Description:</span> {task.appointments.problem_description}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {task.admin_notes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Assignment Notes</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{task.admin_notes}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Staff Notes</p>
                        <textarea
                          value={staffNotesEdit[task.id] ?? task.staff_notes}
                          onChange={(e) => setStaffNotesEdit((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          rows={4}
                          placeholder="Add your notes, progress updates, observations, or anything the manager should know..."
                          className="w-full border border-blue-300 rounded-lg p-2.5 text-sm text-gray-800 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        />
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Time Spent</p>
                        <p className="text-xs text-green-600 mb-2">Enter total hours worked on this task</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={timeSpentEdit[task.id] ?? ''}
                            onChange={(e) => setTimeSpentEdit((prev) => ({ ...prev, [task.id]: e.target.value }))}
                            placeholder="0.0"
                            className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                          />
                          <span className="text-sm text-green-700 font-medium whitespace-nowrap">hrs</span>
                        </div>
                        {task.time_spent_minutes > 0 && (
                          <p className="text-xs text-green-600 mt-1.5">
                            Saved: {formatTimeSpent(task.time_spent_minutes)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-600 border border-slate-500 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Parts Needed</p>
                          <p className="text-xs text-slate-300 mt-0.5">List any parts or materials required for this task</p>
                        </div>
                        {addingPartForTask !== task.id && (
                          <button
                            onClick={() => { setAddingPartForTask(task.id); setNewPart({ part_name: '', quantity: '', notes: '' }); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-500 border border-slate-400 text-slate-100 hover:bg-slate-400 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            Add Part
                          </button>
                        )}
                      </div>

                      {(task.daily_task_parts ?? []).length === 0 && addingPartForTask !== task.id && (
                        <p className="text-xs text-slate-400 italic">No parts added yet. Click "Add Part" if parts are needed.</p>
                      )}

                      {(task.daily_task_parts ?? []).length > 0 && (
                        <div className="space-y-2 mb-3">
                          <div className="grid grid-cols-12 gap-2 px-1 text-xs font-semibold text-slate-300 uppercase tracking-wide">
                            <span className="col-span-5">Part</span>
                            <span className="col-span-2">Qty</span>
                            <span className="col-span-4">Notes</span>
                            <span className="col-span-1" />
                          </div>
                          {(task.daily_task_parts ?? []).map((part) => (
                            <div key={part.id} className="grid grid-cols-12 gap-2 items-center bg-slate-500 border border-slate-400 rounded-lg px-2.5 py-2">
                              <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                                <Package className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                                <p className="text-sm font-medium text-white truncate">{part.part_name}</p>
                              </div>
                              <p className="col-span-2 text-sm text-slate-200">{part.quantity || '—'}</p>
                              <p className="col-span-4 text-xs text-slate-300 truncate">{part.notes || '—'}</p>
                              <div className="col-span-1 flex justify-end">
                                <button
                                  onClick={() => handleDeletePart(part.id)}
                                  disabled={deletingPartId === part.id}
                                  className="text-slate-300 hover:text-red-400 transition-colors"
                                >
                                  {deletingPartId === part.id ? (
                                    <div className="w-3.5 h-3.5 animate-spin rounded-full border-b-2 border-red-400" />
                                  ) : (
                                    <X className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {addingPartForTask === task.id && (
                        <div className="border border-slate-400 rounded-lg p-3 space-y-2 bg-slate-500 mt-2">
                          <input
                            type="text"
                            value={newPart.part_name}
                            onChange={(e) => setNewPart((p) => ({ ...p, part_name: e.target.value }))}
                            placeholder="Part name or description *"
                            className="w-full border border-slate-400 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newPart.quantity}
                              onChange={(e) => setNewPart((p) => ({ ...p, quantity: e.target.value }))}
                              placeholder="Quantity"
                              className="w-28 border border-slate-400 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                            />
                            <input
                              type="text"
                              value={newPart.notes}
                              onChange={(e) => setNewPart((p) => ({ ...p, notes: e.target.value }))}
                              placeholder="Notes (optional)"
                              className="flex-1 border border-slate-400 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddPart(task.id)}
                              disabled={savingPart || !newPart.part_name.trim()}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              {savingPart ? 'Adding...' : 'Add Part'}
                            </button>
                            <button
                              onClick={() => setAddingPartForTask(null)}
                              className="px-3 py-1.5 border border-slate-400 text-slate-100 hover:bg-slate-400 rounded-lg text-xs font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-600 gap-3 flex-wrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveStaffUpdates(task.id)}
                          disabled={savingTaskId === task.id}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {savingTaskId === task.id ? 'Saving...' : 'Save Updates'}
                        </button>
                        <button
                          onClick={() => handleMarkComplete(task.id)}
                          disabled={savingTaskId === task.id}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {savingTaskId === task.id ? 'Completing...' : 'Mark Complete'}
                        </button>
                      </div>

                      {canManage && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          disabled={deletingTaskId === task.id}
                          className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors border border-red-200"
                        >
                          {deletingTaskId === task.id ? (
                            <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-red-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowCompletedSection((v) => !v)}
            className="flex items-center gap-2 w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl text-sm font-medium text-slate-200 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span>Completed Tasks</span>
            <span className="ml-1 px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-xs font-semibold border border-green-500/30">
              {completedTasks.length}
            </span>
            <span className="ml-auto">
              {showCompletedSection ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </span>
          </button>

          {showCompletedSection && (
            <div className="mt-3 space-y-2">
              {completedTasks.map((task) => {
                const isExpanded = expandedCompletedId === task.id;
                const assigneeName = task.assigned_to
                  ? ([task.assigned_to_profile?.first_name, task.assigned_to_profile?.last_name].filter(Boolean).join(' ') || 'Unknown')
                  : 'Unassigned';
                const assignerName = [task.assigned_by_profile?.first_name, task.assigned_by_profile?.last_name].filter(Boolean).join(' ') || 'Unknown';
                const timeFormatted = formatTimeSpent(task.time_spent_minutes);

                return (
                  <div key={task.id} className="bg-slate-700/60 rounded-xl border border-slate-600/60">
                    <div
                      className="flex items-start gap-3 p-4 cursor-pointer select-none"
                      onClick={() => setExpandedCompletedId(isExpanded ? null : task.id)}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-slate-300 text-sm line-through">{task.title}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {timeFormatted && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Clock className="w-3 h-3" />
                                {timeFormatted}
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          {canManage && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <User className="w-3 h-3" />
                              {assigneeName}
                            </span>
                          )}
                          {task.yachts && (
                            <span className="flex items-center gap-1 text-xs text-blue-400/70">
                              <Ship className="w-3 h-3" />
                              {task.yachts.name}
                            </span>
                          )}
                          {task.completed_at && (
                            <span className="flex items-center gap-1 text-xs text-green-400/80">
                              <CheckCircle2 className="w-3 h-3" />
                              {formatCompletedAt(task.completed_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-600/60 p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
                          {canManage && (
                            <span>
                              <span className="font-medium text-slate-300">Assigned to:</span> {assigneeName}
                            </span>
                          )}
                          <span><span className="font-medium text-slate-300">Assigned by:</span> {assignerName}</span>
                          <span><span className="font-medium text-slate-300">Task date:</span> {formatTaskDate(task.task_date)}</span>
                          {task.completed_at && (
                            <span><span className="font-medium text-slate-300">Completed:</span> {formatCompletedAt(task.completed_at)}</span>
                          )}
                        </div>

                        {task.admin_notes && (
                          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
                            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">Assignment Notes</p>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{task.admin_notes}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Staff Notes</p>
                            {task.staff_notes ? (
                              <p className="text-sm text-slate-300 whitespace-pre-wrap">{task.staff_notes}</p>
                            ) : (
                              <p className="text-sm text-slate-500 italic">No notes entered.</p>
                            )}
                          </div>

                          <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">Time Spent</p>
                            {task.time_spent_minutes > 0 ? (
                              <p className="text-2xl font-bold text-green-300">{formatTimeSpent(task.time_spent_minutes)}</p>
                            ) : (
                              <p className="text-sm text-slate-500 italic">No time logged.</p>
                            )}
                          </div>
                        </div>

                        {(task.daily_task_parts ?? []).length > 0 && (
                          <div className="bg-slate-600/40 border border-slate-500/50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Parts Used</p>
                            <div className="space-y-1.5">
                              {(task.daily_task_parts ?? []).map((part) => (
                                <div key={part.id} className="flex items-center gap-2 bg-slate-600/50 rounded-lg px-2.5 py-2">
                                  <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="text-sm text-slate-200 font-medium">{part.part_name}</span>
                                  {part.quantity && <span className="text-xs text-slate-400 ml-1">Qty: {part.quantity}</span>}
                                  {part.notes && <span className="text-xs text-slate-400 ml-1">— {part.notes}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {canManage && (
                          <div className="flex justify-between pt-1 border-t border-slate-600/60">
                            <button
                              onClick={() => handleMarkIncomplete(task.id)}
                              disabled={savingTaskId === task.id}
                              className="flex items-center gap-1.5 px-3 py-2 text-amber-400 hover:bg-amber-500/10 rounded-lg text-sm font-medium transition-colors border border-amber-500/30"
                            >
                              {savingTaskId === task.id ? (
                                <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-amber-400" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                              Mark Incomplete
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              disabled={deletingTaskId === task.id}
                              className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors border border-red-500/30"
                            >
                              {deletingTaskId === task.id ? (
                                <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-red-500" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showCreateModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[9999] p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col my-4 sm:my-8 mx-2 sm:mx-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Create Daily Task</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setModalParts([]);
                  setModalPartDraft({ part_name: '', quantity: '', notes: '' });
                  setShowModalPartForm(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Oil change on slip 12 boat"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To
                  <span className="text-gray-400 font-normal ml-1">(optional — assign later if unknown)</span>
                </label>
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask((p) => ({ ...p, assigned_to: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                >
                  <option value="">Unassigned</option>
                  {staffOptions.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {[s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Date *</label>
                <input
                  type="date"
                  value={newTask.task_date}
                  onChange={(e) => setNewTask((p) => ({ ...p, task_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yacht (optional)</label>
                  <select
                    value={newTask.yacht_id}
                    onChange={(e) => setNewTask((p) => ({ ...p, yacht_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {yachtOptions.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer (optional)</label>
                  <select
                    value={newTask.customer_id}
                    onChange={(e) => setNewTask((p) => ({ ...p, customer_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {customerOptions.map((c) => (
                      <option key={c.id} value={c.id}>{customerDisplayName(c)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Notes</label>
                <textarea
                  value={newTask.admin_notes}
                  onChange={(e) => setNewTask((p) => ({ ...p, admin_notes: e.target.value }))}
                  rows={3}
                  placeholder="Describe what needs to be done, any specific instructions, special requirements..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Staff will fill out when working</p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-blue-100 rounded-lg px-3 py-2 text-xs text-gray-400 italic">Staff notes / updates...</div>
                  <div className="bg-white border border-blue-100 rounded-lg px-3 py-2 text-xs text-gray-400 italic">Time spent (hrs)...</div>
                </div>

                <div className="border-t border-blue-200 pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Parts Needed</p>
                      <p className="text-xs text-blue-500">List any parts or materials the staff member should bring</p>
                    </div>
                    {!showModalPartForm && (
                      <button
                        type="button"
                        onClick={() => setShowModalPartForm(true)}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                      >
                        <Plus className="w-3 h-3" />
                        Add Part
                      </button>
                    )}
                  </div>

                  {modalParts.length === 0 && !showModalPartForm && (
                    <p className="text-xs text-gray-400 italic mt-1">No parts added yet.</p>
                  )}

                  {modalParts.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {modalParts.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-2.5 py-2">
                          <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-800">{p.part_name}</span>
                            {p.quantity && <span className="text-xs text-gray-500 ml-2">Qty: {p.quantity}</span>}
                            {p.notes && <span className="text-xs text-gray-500 ml-2">— {p.notes}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => setModalParts((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showModalPartForm && (
                    <div className="space-y-2 mt-2 border-t border-blue-100 pt-2">
                      <input
                        type="text"
                        value={modalPartDraft.part_name}
                        onChange={(e) => setModalPartDraft((p) => ({ ...p, part_name: e.target.value }))}
                        placeholder="Part name or description *"
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent bg-white"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={modalPartDraft.quantity}
                          onChange={(e) => setModalPartDraft((p) => ({ ...p, quantity: e.target.value }))}
                          placeholder="Quantity"
                          className="w-28 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent bg-white"
                        />
                        <input
                          type="text"
                          value={modalPartDraft.notes}
                          onChange={(e) => setModalPartDraft((p) => ({ ...p, notes: e.target.value }))}
                          placeholder="Notes (optional)"
                          className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!modalPartDraft.part_name.trim()}
                          onClick={() => {
                            if (!modalPartDraft.part_name.trim()) return;
                            setModalParts((prev) => [...prev, { ...modalPartDraft }]);
                            setModalPartDraft({ part_name: '', quantity: '', notes: '' });
                            setShowModalPartForm(false);
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowModalPartForm(false); setModalPartDraft({ part_name: '', quantity: '', notes: '' }); }}
                          className="px-3 py-1.5 border border-blue-200 text-gray-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-blue-500">Staff tap the task card to add their notes and log time spent.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setModalParts([]);
                  setModalPartDraft({ part_name: '', quantity: '', notes: '' });
                  setShowModalPartForm(false);
                }}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={creatingTask || !newTask.title.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {creatingTask ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {showPrintModal && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-gray-900">Print Daily Tasks</h2>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 border-b border-gray-100 flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Date</label>
                <input
                  type="date"
                  value={printDate}
                  onChange={(e) => handlePrintDateChange(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Staff Member</label>
                <select
                  value={printStaffFilter}
                  onChange={(e) => setPrintStaffFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="all">All Staff</option>
                  {staffOptions.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {[s.first_name, s.last_name].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
              {loadingPrint ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500" />
                </div>
              ) : (() => {
                const filtered = printStaffFilter === 'all'
                  ? printTasks
                  : printTasks.filter((t) => t.assigned_to === printStaffFilter);

                const grouped: Record<string, DailyTask[]> = {};
                filtered.forEach((t) => {
                  const key = t.assigned_to || 'unassigned';
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(t);
                });

                if (Object.keys(grouped).length === 0) {
                  return <p className="text-center text-gray-400 py-8">No tasks found for this date.</p>;
                }

                const today = new Date().toISOString().split('T')[0];

                return (
                  <div className="space-y-6">
                    {Object.entries(grouped).map(([staffId, staffTasks]) => {
                      const profile = staffTasks[0]?.assigned_to_profile;
                      const name = staffId === 'unassigned'
                        ? 'Unassigned'
                        : ([profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Unknown');
                      return (
                        <div key={staffId} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-slate-800 text-white">
                            <h3 className="font-bold text-base">{name}</h3>
                            <p className="text-slate-300 text-xs mt-0.5">{staffTasks.length} task{staffTasks.length !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {staffTasks.map((t) => {
                              const isCompleted = t.is_completed;
                              const isOverdue = !isCompleted && t.task_date < today;
                              const statusLabel = isCompleted ? 'Completed' : isOverdue ? 'Overdue' : 'Open';
                              const statusCls = isCompleted
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : isOverdue
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : 'bg-yellow-100 text-yellow-800 border border-yellow-300';
                              const customerName = t.customers
                                ? (t.customers.customer_type === 'business'
                                  ? t.customers.business_name
                                  : [t.customers.first_name, t.customers.last_name].filter(Boolean).join(' '))
                                : null;
                              return (
                                <div key={t.id} className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-4 h-4 border-2 border-gray-400 rounded mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="font-semibold text-gray-900 text-sm">{t.title}</span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusCls}`}>{statusLabel}</span>
                                      </div>
                                      {(() => {
                                        const cvName = t.customers?.customer_vessels?.[0]?.vessel_name ?? null;
                                        const vesselDisplay = t.yachts
                                          ? t.yachts.name + (t.yachts.marina_slip ? ` — Slip: ${t.yachts.marina_slip}` : '')
                                          : cvName ?? null;
                                        return (vesselDisplay || customerName || t.appointments) ? (
                                          <div className="flex flex-wrap gap-2 mt-1.5">
                                            {vesselDisplay && (
                                              <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs px-2 py-0.5 rounded">
                                                &#9875; {vesselDisplay}
                                              </span>
                                            )}
                                            {customerName && <span className="text-xs text-gray-500"><span className="font-semibold text-gray-700">Customer:</span> {customerName}</span>}
                                            {t.appointments && <span className="text-xs text-gray-500"><span className="font-semibold text-gray-700">Appt:</span> {t.appointments.name}</span>}
                                          </div>
                                        ) : null;
                                      })()}
                                      {t.admin_notes && (
                                        <div className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 text-gray-700">
                                          <span className="font-semibold">Notes: </span>{t.admin_notes}
                                        </div>
                                      )}
                                      {(t.daily_task_parts ?? []).length > 0 && (
                                        <div className="mt-2">
                                          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Parts</p>
                                          {(t.daily_task_parts ?? []).map((p) => (
                                            <div key={p.id} className="flex gap-3 text-xs text-gray-600 py-1 border-b border-gray-100 last:border-0">
                                              <span className="font-medium">{p.part_name}</span>
                                              {p.quantity && <span className="text-gray-500">Qty: {p.quantity}</span>}
                                              {p.notes && <span className="text-gray-400">— {p.notes}</span>}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePrint}
                disabled={loadingPrint || printTasks.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
