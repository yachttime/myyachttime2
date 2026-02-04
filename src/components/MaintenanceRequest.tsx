import { useState } from 'react';
import { Anchor, ArrowLeft, Send, Upload, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadFileToStorage } from '../utils/fileUpload';

interface MaintenanceRequestProps {
  onBack: () => void;
}

export const MaintenanceRequest = ({ onBack }: MaintenanceRequestProps) => {
  const { user, userProfile, yacht } = useAuth();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !yacht) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      let fileUrl = null;
      let fileName = null;

      if (photoFile) {
        const uploadResult = await uploadFileToStorage(
          photoFile,
          'repair-files',
          `${yacht.id}/${Date.now()}_${photoFile.name}`
        );

        if (uploadResult.error) {
          throw new Error(uploadResult.error);
        }

        fileUrl = uploadResult.url;
        fileName = photoFile.name;
      }

      const { data: insertedData, error: dbError } = await supabase.from('repair_requests').insert({
        submitted_by: user.id,
        yacht_id: yacht.id,
        title: subject,
        description: description,
        file_url: fileUrl,
        file_name: fileName,
        status: 'pending',
        is_retail_customer: false,
      }).select().single();

      if (dbError) {
        console.error('Error inserting repair request:', dbError);
        throw dbError;
      }

      // Send notification emails to managers
      try {
        const { data: managers, error: managersError } = await supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name, email')
          .eq('yacht_id', yacht.id)
          .eq('role', 'manager');

        if (!managersError && managers && managers.length > 0) {
          const managersWithEmail = managers.filter(m => m.email);

          if (managersWithEmail.length > 0) {
            const emailAddresses = managersWithEmail.map(m => m.email).join(', ');
            const { data: { session } } = await supabase.auth.getSession();

            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-repair-notification`;

            await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                managerEmails: managersWithEmail.map(m => m.email),
                managerNames: managersWithEmail.map(m => `${m.first_name} ${m.last_name}`),
                repairTitle: subject,
                yachtName: yacht.name,
                submitterName: userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name || ''}`.trim() : 'Unknown',
                repairRequestId: insertedData.id
              })
            });

            // Update the repair request with notification recipients
            await supabase
              .from('repair_requests')
              .update({ notification_recipients: emailAddresses })
              .eq('id', insertedData.id);
          }
        }
      } catch (emailError) {
        console.error('Failed to send email notifications:', emailError);
        // Don't fail the whole request if email fails
      }

      setSuccess(true);
      setSubject('');
      setDescription('');
      setPhotoFile(null);
      setPhotoPreview(null);

      setTimeout(() => {
        setSuccess(false);
        onBack();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Anchor className="w-7 h-7 text-amber-500" />
            <h1 className="text-xl font-bold tracking-wide">MY YACHT TIME</h1>
          </div>
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Maintenance Request</h2>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 mb-6">
            <div className="mb-4">
              <p className="text-slate-400">Yacht:</p>
              <p className="text-lg font-semibold">{yacht?.name || 'No yacht assigned'}</p>
            </div>
            <div>
              <p className="text-slate-400">Owner Email:</p>
              <p className="text-lg font-semibold">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <div className="space-y-6">
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-2">
                    Subject
                  </label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of the issue"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide detailed information about the maintenance request..."
                    rows={8}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="maintenance-photo" className="block text-sm font-medium mb-2">
                    Photo (Optional)
                  </label>
                  {!photoPreview ? (
                    <label htmlFor="maintenance-photo" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-amber-500 transition-colors">
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-400">Click to upload photo</span>
                      <span className="text-xs text-slate-500 mt-1">Max 10MB</span>
                      <input
                        id="maintenance-photo"
                        name="photo"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm">
                Maintenance request submitted successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              {loading ? 'Sending...' : 'Send to Manager'}
            </button>
          </form>

          <div className="mt-8 rounded-2xl overflow-hidden shadow-2xl">
            <img
              src="https://images.pexels.com/photos/1838640/pexels-photo-1838640.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750"
              alt="Yacht maintenance"
              className="w-full h-48 object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
