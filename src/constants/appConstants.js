export const goals = ["ENEM", "Polícia Penal", "INSS", "Escola", "Faculdade", "Outro concurso"];

export const statusOptions = ["Hoje", "Prioridade", "Revisão"];

export const filterOptions = ["Todas", "Hoje", "Prioridade", "Revisão", "Concluídas"];

export const tasksByGoal = {
  ENEM: [
    { subject: "Matemática", time: "1h 20min", status: "Hoje" },
    { subject: "Redação", time: "50min", status: "Prioridade" },
    { subject: "Ciências Humanas", time: "1h", status: "Revisão" },
  ],
  "Polícia Penal": [
    { subject: "Português", time: "1h", status: "Hoje" },
    { subject: "Legislação Específica", time: "1h 30min", status: "Prioridade" },
    { subject: "Informática", time: "45min", status: "Revisão" },
  ],
  INSS: [
    { subject: "Direito Previdenciário", time: "1h 20min", status: "Hoje" },
    { subject: "Raciocínio Lógico", time: "50min", status: "Prioridade" },
    { subject: "Português", time: "45min", status: "Revisão" },
  ],
  Escola: [
    { subject: "Matemática", time: "40min", status: "Hoje" },
    { subject: "História", time: "35min", status: "Prioridade" },
    { subject: "Português", time: "30min", status: "Revisão" },
  ],
  Faculdade: [
    { subject: "Resumo da matéria", time: "50min", status: "Hoje" },
    { subject: "Exercícios", time: "1h", status: "Prioridade" },
    { subject: "Revisão", time: "30min", status: "Revisão" },
  ],
  "Outro concurso": [
    { subject: "Conhecimentos Gerais", time: "1h", status: "Hoje" },
    { subject: "Lei específica", time: "1h 10min", status: "Prioridade" },
    { subject: "Questões", time: "45min", status: "Revisão" },
  ],
};
