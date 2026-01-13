import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('replies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const csvHeaders = [
      'ID',
      'Created At',
      'Classification',
      'Patient Messages',
      'AI Reply',
      'Feedback',
      'Feedback Comment',
    ];

    const csvRows = data.map((row) => [
      row.id,
      row.created_at,
      row.classification,
      `"${(row.patient_messages || '').replace(/"/g, '""')}"`,
      `"${(row.ai_reply || '').replace(/"/g, '""')}"`,
      row.feedback || '',
      row.feedback_comment || '',
    ]);

    const csv = [
      csvHeaders.join(','),
      ...csvRows.map((row) => row.join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=replies_export.csv',
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}