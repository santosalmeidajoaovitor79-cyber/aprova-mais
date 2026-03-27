import { useCallback, useState } from "react";
import * as profilesApi from "../api/profilesApi.js";

/**
 * Campos de perfil + ensure / load / save (usa API isolada).
 */
export function useAccountProfile(supabase, setError) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [goal, setGoal] = useState("Polícia Penal");
  const [hours, setHours] = useState("2");
  const [examDate, setExamDate] = useState("");
  const [mainExamId, setMainExamId] = useState("");
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [studyMetaReady, setStudyMetaReady] = useState(false);
  const [studyMeta, setStudyMeta] = useState({
    mainExamId: null,
    lastContestId: null,
    lastSubjectId: null,
    lastTopicId: null,
  });

  const ensureProfile = useCallback(
    async (user) => {
      const { data: existing, error: selectError } = await profilesApi.selectProfileId(supabase, user.id);

      if (selectError) {
        setError(selectError.message);
        return { error: selectError, inserted: false, existing: false };
      }

      if (!existing) {
        const { error: insertError } = await profilesApi.insertProfile(supabase, {
          id: user.id,
          name: user.user_metadata?.name ?? name ?? "",
          email: user.email ?? "",
          goal,
          hours_per_day: hours,
          exam_date: examDate?.trim() || null,
          onboarding_done: false,
          updated_at: new Date().toISOString(),
        });

        if (insertError) {
          setError(insertError.message);
          return { error: insertError, inserted: false, existing: false };
        }

        return { error: null, inserted: true, existing: false };
      }

      return { error: null, inserted: false, existing: true };
    },
    [supabase, setError, name, goal, hours, examDate]
  );

  const loadProfile = useCallback(
    async (userId, fallbackEmail) => {
      setError("");
      setStudyMetaReady(false);

      const { data, error } = await profilesApi.selectProfileFields(supabase, userId);

      if (error) {
        setError(error.message);
        setStudyMetaReady(true);
        return;
      }

      if (!data) {
        setStudyMetaReady(true);
        return;
      }

      setName(data.name ?? "");
      setEmail(data.email ?? fallbackEmail ?? "");
      setGoal(data.goal ?? "Polícia Penal");
      setHours(String(data.hours_per_day ?? "2"));
      const ed = data.exam_date;
      setExamDate(typeof ed === "string" ? ed.slice(0, 10) : ed ? String(ed).slice(0, 10) : "");
      const mid = data.main_exam_id;
      setMainExamId(mid ? String(mid) : "");
      setOnboardingDone(Boolean(data.onboarding_done));
      setStudyMeta({
        mainExamId: data.main_exam_id ?? null,
        lastContestId: data.last_contest_id ?? null,
        lastSubjectId: data.last_subject_id ?? null,
        lastTopicId: data.last_topic_id ?? null,
      });
      setStudyMetaReady(true);
    },
    [supabase, setError]
  );

  const saveProfile = useCallback(
    async (user) => {
      if (!user) return;

      const { error } = await profilesApi.upsertProfile(supabase, {
        id: user.id,
        name: name.trim(),
        email: user.email,
        goal,
        hours_per_day: hours,
        exam_date: examDate?.trim() || null,
        main_exam_id: mainExamId?.trim() || null,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    },
    [supabase, name, goal, hours, examDate, mainExamId]
  );

  const completeOnboarding = useCallback(
    async (user, payload) => {
      if (!user) return;

      const { error } = await profilesApi.patchProfileOnboarding(supabase, user.id, {
        examDate: payload.examDate,
        hoursPerDay: payload.hoursPerDay ?? (Number(hours) || 2),
        mainExamId: payload.mainExamId ?? null,
        goalLabel: payload.goalLabel ?? "",
      });

      if (error) throw error;
      setMainExamId(payload.mainExamId ? String(payload.mainExamId) : "");
      setExamDate(payload.examDate?.trim() || "");
      setHours(String(payload.hoursPerDay ?? hours));
      if (payload.goalLabel?.trim()) {
        setGoal(payload.goalLabel.trim());
      }
      setOnboardingDone(true);
      setStudyMeta((prev) => ({
        ...prev,
        mainExamId: payload.mainExamId ?? null,
      }));
    },
    [supabase, hours]
  );

  return {
    name,
    setName,
    email,
    setEmail,
    goal,
    setGoal,
    hours,
    setHours,
    examDate,
    setExamDate,
    mainExamId,
    setMainExamId,
    onboardingDone,
    setOnboardingDone,
    studyMeta,
    studyMetaReady,
    ensureProfile,
    loadProfile,
    saveProfile,
    completeOnboarding,
  };
}
