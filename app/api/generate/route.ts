import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

// ============================================
// HELPER FUNCTIONS
// ============================================

const ASS_SYNONYMS = [
  "صرمي", "طيزي", "طيز", "مؤخرتي", "مؤخرة",
  "خلفيتي", "خلفية", "دبري",
];

const FORBIDDEN_CLOSINGS = [
  "يحتاج انتباه", "يحتاج متابعة", "مهم نتابع", "لا تهملي",
  "شكرًا لتواصلك", "أتمنى لك الصحة والعافية",
  "لا تترددي", "خبريني", "إذا احتجتِ",
];

const FORBIDDEN_REASSURANCE = [
  "عادي", "لا يؤثر", "لا مشكلة", "أكيد",
  "من الجيد", "الوضع مطمئن",
];

function normalizeAnatomy(s: string) {
  let out = s;
  ASS_SYNONYMS.forEach(word => {
    const regex = new RegExp(word, "gi");
    out = out.replace(regex, "أسفل الظهر");
  });
  return out;
}

function splitSentencesIntoLines(s: string) {
  const lines = s.split(/\r?\n/);
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.match(/[^.؟!]+[.؟!]?/g);
    if (parts) {
      parts.map(p => p.trim()).filter(Boolean).forEach(p => result.push(p));
    } else {
      result.push(trimmed);
    }
  }
  return result.join("\n");
}

function countLines(s: string) {
  return s.trim().split(/\r?\n/).filter(Boolean).length;
}

function startsWithAllowedOpening(s: string) {
  const t = s.trim();
  return (
    t.startsWith("سلامتك 🌸") ||
    t.startsWith("مساء الخير 🌸") ||
    t.startsWith("صباح الخير 🌸")
  );
}

function containsForbiddenPhrases(s: string) {
  return [...FORBIDDEN_CLOSINGS, ...FORBIDDEN_REASSURANCE].some(p => s.includes(p));
}

function validateReply(ai_reply: string, scenario: string) {
  // Check opening
  if (!startsWithAllowedOpening(ai_reply)) return false;
  
  // Check line count
  const lines = countLines(ai_reply);
  if (lines < 3 || lines > 4) return false;
  
  // Check forbidden phrases
  if (containsForbiddenPhrases(ai_reply)) return false;

  // Scenario-specific validation
  if (scenario === "MRI_PERIOD") {
    const target =
      "سلامتك 🌸\n" +
      "يُفضل تعملي الرنين بعد انتهاء الدورة.\n" +
      "غالبًا اليوم الخامس أو السادس هيك بتكون النتيجة أدق.";
    if (ai_reply.trim() !== target.trim()) return false;
  }

  if (scenario === "PAIN_PREGNANCY") {
    if (!ai_reply.includes("لا يمكن")) return false;
    if (!ai_reply.includes("الطوارئ")) return false;
    if (!ai_reply.includes("العيادة")) return false;
    
    // No anatomy terms allowed
    if (
      ai_reply.includes("الحوض") ||
      ai_reply.includes("المؤخرة") ||
      ai_reply.includes("الشرج") ||
      ai_reply.includes("المستقيم")
    ) {
      return false;
    }
  }

  if (scenario === "IRON_ANEMIA") {
    // Must mention both oral and IV options
    if (!ai_reply.includes("عن طريق الفم") && !ai_reply.includes("الوريدي")) return false;
    // Must refer to clinic
    if (!ai_reply.includes("العيادة")) return false;
    // No reassurance allowed
    if (ai_reply.includes("من الجيد") || ai_reply.includes("الوضع مطمئن")) return false;
  }
  
  return true;
}

// ============================================
// OPENAI & COMPACT SYSTEM PROMPT
// ============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `أنتِ مساعدة طبيبة نسائية لصياغة ردود واتساب قصيرة.

🎯 المهمة
- صياغة فقط (لا تشخيص، لا علاج، لا قرارات طبية)
- فهم المشكلة الأساسية من رسائل مريضة (قد تحتوي تواريخ/أسماء/تكرار)
- كتابة رد واحد قصير بأسلوب واتساب طبيعي

📐 البنية الإلزامية
- 3-4 أسطر فقط
- سطر واحد = فكرة واحدة (لا دمج جمل)
- بدون نقاط/تعداد/أسئلة

🌸 الافتتاحية (اختاري واحدة فقط)
سلامتك 🌸 | مساء الخير 🌸 | صباح الخير 🌸

🚫 ممنوعات مطلقة
- تشخيص أو خطة علاج أو جرعات
- عبارات: (عادي، أكيد، لا يؤثر، من الجيد، الوضع مطمئن)
- ختام: (خبريني، لا تترددي، شكرًا لتواصلك، أتمنى الصحة)
- مصطلحات عامية (استبدلي بـ: أسفل الظهر)
- أوامر مباشرة

🏥 القاعدة الذهبية (Clinic-First)
أعراض جسدية → "لا يمكن تقييم/تشخيص بدقة عبر الرسائل"
- ألم شديد → الطوارئ
- ألم مستمر → العيادة
- يُسمح بذكر مسكن بسيط (باراسيتامول) بدون جرعة

━━━━━━━━━━━━━━━━━━━━
🔒 قوالب إلزامية حرفية
━━━━━━━━━━━━━━━━━━━━

[MRI + Period]
سلامتك 🌸
يُفضل تعملي الرنين بعد انتهاء الدورة.
غالبًا اليوم الخامس أو السادس هيك بتكون النتيجة أدق.

[Pain + Pregnancy]
سلامتك 🌸
الألم في أسفل الظهر أثناء الحمل لا يمكن تشخيصه بدقة عبر الرسائل.
إذا كان الألم شديد، يُفضل التوجه للطوارئ.
وإذا كان محتمل لكنه مستمر، يُفضل مراجعة العيادة للفحص.

[Iron/Ferritin/Anemia]
سلامتك 🌸
انخفاض مخزون الحديد ممكن يصير حتى لو قوة الدم جيدة، ولا يمكن تحديد الحاجة للعلاج أو نوعه بدقة عبر الرسائل.
غالبًا يُستخدم الحديد عن طريق الفم كبداية في حالات كثيرة.
الحديد الوريدي يُلجأ له بحالات معينة، ويُفضّل تحديد الخيار الأنسب بعد تقييم في العيادة.

━━━━━━━━━━━━━━━━━━━━
📥 المدخلات
التصنيف: {{classification}}
الرسائل: {{patient_messages}}

📤 المخرج
رد واحد جاهز للإرسال، آمن طبيًا، مطابق للقواعد.`;

// ============================================
// API ROUTE
// ============================================

export async function POST(request: Request) {
  try {
    const { classification, patient_messages } = await request.json();

    if (!classification || !patient_messages) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Classification: ${classification}\n\nPatient Messages:\n${patient_messages}`,
        },
      ],
      temperature: 0.7,
    });

    let ai_reply = completion.choices[0]?.message?.content || '';

    // Apply post-processing
    ai_reply = normalizeAnatomy(ai_reply);
    ai_reply = splitSentencesIntoLines(ai_reply);

    // Determine scenario for validation
    const scenario =
      classification === "MRI + Period" ? "MRI_PERIOD" :
      classification === "Pain + Pregnancy" ? "PAIN_PREGNANCY" :
      classification === "Iron Deficiency / Anemia" ? "IRON_ANEMIA" :
      "DEFAULT";

    // Validate reply
    if (!validateReply(ai_reply, scenario)) {
      return NextResponse.json({ 
        ai_reply, 
        qa_failed: true,
        message: "⚠️ الرد يحتاج مراجعة يدوية"
      });
    }

    // Save to database
    const { data, error } = await supabase
      .from('replies')
      .insert({
        classification,
        patient_messages,
        ai_reply,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      id: data.id,
      ai_reply,
    });
  } catch (error: any) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
