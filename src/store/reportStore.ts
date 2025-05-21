import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FormData } from '@/types';

interface ReportProgress {
  stage: string;
  percentage: number;
  message: string;
  timeRemaining: number | null;
  currentCampaign: number;
  totalCampaigns: number;
}

interface ReportState {
  isGenerating: boolean;
  formData: FormData | null;
  progress: ReportProgress;
  setIsGenerating: (isGenerating: boolean) => void;
  setFormData: (formData: FormData | null) => void;
  setProgress: (progress: ReportProgress) => void;
  resetProgress: () => void;
}

const initialProgress: ReportProgress = {
  stage: '',
  percentage: 0,
  message: '',
  timeRemaining: null,
  currentCampaign: 0,
  totalCampaigns: 0,
};

type ReportPersist = StateCreator<
  ReportState,
  [],
  [["zustand/persist", unknown]]
>;

export const useReportStore = create<ReportState>()(
  persist(
    (set: (state: Partial<ReportState>) => void): ReportState => ({
      isGenerating: false,
      formData: null,
      progress: initialProgress,
      setIsGenerating: (isGenerating: boolean) => set({ isGenerating }),
      setFormData: (formData: FormData | null) => set({ formData }),
      setProgress: (progress: ReportProgress) => set({ progress }),
      resetProgress: () => set({ progress: initialProgress }),
    }),
    {
      name: 'report-store',
      partialize: (state: ReportState) => ({
        formData: state.formData,
        isGenerating: state.isGenerating,
      }),
    }
  )
); 