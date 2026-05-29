// Hook que agrega as respostas das perguntas regionais da campanha efetiva,
// pronto para os gráficos da Inteligência Eleitoral. Agregação local (pura)
// via aggregateQuestion — evita depender de RPC.

import { useCallback, useEffect, useState } from 'react';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { aggregateQuestion, type QuestionAnalytics } from '@/lib/customQuestions';
import type { CampaignQuestion, InterviewCustomAnswer } from '@/types';

type RawAnswer = Pick<
  InterviewCustomAnswer,
  'question_id' | 'answer_text' | 'answer_option' | 'answer_options' | 'answer_scale'
>;

export function useCustomQuestionsAnalytics() {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;

  const [analytics, setAnalytics] = useState<QuestionAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!campaignId || USE_MOCKS) {
      setAnalytics([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: qData, error: qErr }, { data: aData, error: aErr }] = await Promise.all([
      supabase
        .from('campaign_questions')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('interview_custom_answers')
        .select('question_id, answer_text, answer_option, answer_options, answer_scale')
        .eq('campaign_id', campaignId),
    ]);
    setLoading(false);
    if (qErr || aErr) {
      console.warn('useCustomQuestionsAnalytics:', qErr?.message ?? aErr?.message);
      setAnalytics([]);
      return;
    }
    const questions = (qData ?? []) as CampaignQuestion[];
    const answers = (aData ?? []) as RawAnswer[];

    const byQuestion = new Map<string, RawAnswer[]>();
    for (const a of answers) {
      const arr = byQuestion.get(a.question_id) ?? [];
      arr.push(a);
      byQuestion.set(a.question_id, arr);
    }

    setAnalytics(questions.map((q) => aggregateQuestion(q, byQuestion.get(q.id) ?? [])));
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalAnswered = analytics.reduce((max, a) => Math.max(max, a.total), 0);

  return { analytics, loading, totalAnswered, reload: load };
}
