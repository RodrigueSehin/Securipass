/** Complétion du profil : calculée sur les informations réellement renseignées (pure, testée). */
export type CompletionFields = {
  full_name: string;
  phone: string | null;
  locality: string | null;
  address: string | null;
  profession: string | null;
  experience_band: string | null;
  education_level: string | null;
  languages: string[];
  availability: string | null;
  training_goal: string | null;
  photo_path: string | null;
};

export function profileCompletion(p: CompletionFields) {
  const sections = [
    {
      label: "Informations personnelles",
      done: Boolean(p.full_name.trim() && p.phone && p.locality && p.address),
    },
    {
      label: "Informations professionnelles",
      done: Boolean(p.profession && p.experience_band && p.education_level && p.languages.length && p.availability && p.training_goal),
    },
    { label: "Photo de profil", done: Boolean(p.photo_path) },
  ];
  const done = sections.filter((s) => s.done).length;
  return { percent: Math.round((done / sections.length) * 100), sections, complete: done === sections.length };
}
