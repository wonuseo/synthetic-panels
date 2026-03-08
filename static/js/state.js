export const state = {
  selectedFile: null,
  personasLoaded: false,
  selectedPanelSize: 10,
  samplingSeed: null,
  lastReviews: [],
  lastSynthesis: null,
  lastSynthesisRaw: null,
  lastPersonaSummaries: [],
  lastPanelReviews: [],
  surveyTemplate: [],
  funnelQuantGroupAverages: {},
};

export const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o'];
