'use client';

import { useState } from 'react';

const CLASSIFICATIONS = [
  'Pregnancy & Breastfeeding',
  'Iron Deficiency / Anemia',
  'Medication Safety',
  'General Gynecology',
];

export default function Home() {
  const [classification, setClassification] = useState(CLASSIFICATIONS[0]);
  const [patientMessages, setPatientMessages] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleGenerate = async () => {
    if (!patientMessages.trim()) {
      setError('Please paste patient messages');
      return;
    }

    setLoading(true);
    setError('');
    setAiReply('');
    setReplyId(null);
    setFeedbackGiven(false);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classification, patient_messages: patientMessages }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate reply');
      }

      setAiReply(data.ai_reply);
      setReplyId(data.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(aiReply);
  };

  const handleFeedback = async (feedback: 'useful' | 'not_useful') => {
    if (!replyId) return;

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: replyId, feedback }),
      });
      setFeedbackGiven(true);
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `replies_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Doctor Quick Reply MVP
          </h1>
          <p className="text-gray-600 mb-8">
            Generate professional replies to patient WhatsApp messages
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question Classification
              </label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {CLASSIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste WhatsApp messages exactly as received
              </label>
              <textarea
                value={patientMessages}
                onChange={(e) => setPatientMessages(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Paste patient messages here..."
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Generating...' : 'Generate Reply'}
            </button>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            {aiReply && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Generated Reply
                  </label>
                  <div className="bg-gray-50 border border-gray-300 rounded-md p-4 whitespace-pre-wrap">
                    {aiReply}
                  </div>
                </div>

                <button
                  onClick={handleCopy}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-md font-medium hover:bg-gray-700 transition"
                >
                  Copy Reply
                </button>

                <div className="flex gap-4">
                  <button
                    onClick={() => handleFeedback('useful')}
                    disabled={feedbackGiven}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                  >
                    👍 Useful
                  </button>
                  <button
                    onClick={() => handleFeedback('not_useful')}
                    disabled={feedbackGiven}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                  >
                    👎 Not useful
                  </button>
                </div>

                {feedbackGiven && (
                  <p className="text-sm text-gray-600 text-center">
                    Thank you for your feedback!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-md font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {exporting ? 'Exporting...' : 'Export All Data as CSV'}
          </button>
        </div>
      </div>
    </main>
  );
}