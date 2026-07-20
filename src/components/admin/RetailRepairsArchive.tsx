import { Users } from 'lucide-react';
import { RepairRequest, YachtInvoice } from '../../lib/supabase';

interface RetailRepairsArchiveProps {
  repairRequests: RepairRequest[];
  repairInvoices: { [repairRequestId: string]: YachtInvoice };
  effectiveRole: string;
}

export default function RetailRepairsArchive({ repairRequests, repairInvoices, effectiveRole }: RetailRepairsArchiveProps) {
  const retailRepairs = repairRequests.filter(request =>
    request.is_retail_customer &&
    (request.status === 'completed' || request.status === 'rejected' || repairInvoices[request.id]?.payment_status === 'paid')
  );

  if (!['staff', 'mechanic', 'master'].includes(effectiveRole)) {
    return null;
  }

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Users className="w-6 h-6 text-cyan-500" />
        Retail Customer Repairs Archive
        <span className="text-sm text-slate-400 font-normal">({retailRepairs.length} {retailRepairs.length === 1 ? 'repair' : 'repairs'})</span>
      </h3>

      {retailRepairs.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 border border-slate-700 text-center">
          <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg mb-2">No archived retail repairs yet</p>
          <p className="text-slate-500 text-sm">Completed or denied retail customer repairs will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {retailRepairs.map((repair) => {
            const invoice = repairInvoices[repair.id];
            const isPaid = invoice?.payment_status === 'paid';
            const isDenied = repair.status === 'rejected';
            const statusText = isPaid ? 'Paid' : isDenied ? 'Denied' : 'Completed';

            return (
              <div key={repair.id} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-cyan-500 transition-all flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-lg font-bold text-white">{repair.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        isPaid ? 'bg-emerald-500/20 text-emerald-500' :
                        isDenied ? 'bg-red-500/20 text-red-500' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {statusText}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{repair.customer_name}</p>
                  </div>
                  <Users className="w-6 h-6 text-cyan-500" />
                </div>

                <div className="space-y-2 text-sm mb-4 flex-grow">
                  {repair.customer_email && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="text-white font-medium truncate ml-2">{repair.customer_email}</span>
                    </div>
                  )}
                  {repair.customer_phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Phone:</span>
                      <span className="text-white font-medium">{repair.customer_phone}</span>
                    </div>
                  )}
                  {invoice && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Amount:</span>
                      <span className="text-white font-medium">{invoice.invoice_amount}</span>
                    </div>
                  )}
                  {repair.description && (
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <p className="text-slate-300 text-xs line-clamp-2">{repair.description}</p>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-500 mt-2">
                  {isPaid && invoice?.paid_at ? (
                    `Paid: ${new Date(invoice.paid_at).toLocaleDateString()}`
                  ) : (
                    `Created: ${new Date(repair.created_at).toLocaleDateString()}`
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
