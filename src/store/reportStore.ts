import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FormData } from '@/types';
import type { NewsletterType } from '@/types';

interface Report {
  id: string;
  name: string;
  advertiser: string;
  report_type: NewsletterType;
  date_range: {
    start_date: string;
    end_date: string;
  };
  created: string;
  data: any;
}

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
  reports: Report[];
  setIsGenerating: (isGenerating: boolean) => void;
  setFormData: (formData: FormData | null) => void;
  setProgress: (progress: ReportProgress) => void;
  resetProgress: () => void;
  setReports: (reports: Report[]) => void;
  addReport: (report: Report) => void;
  deleteReport: (reportId: string) => void;
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
    (set) => ({
      isGenerating: false,
      formData: null,
      progress: initialProgress,
      reports: [],
      setIsGenerating: (isGenerating: boolean) => set({ isGenerating }),
      setFormData: (formData: FormData | null) => set({ formData }),
      setProgress: (progress: ReportProgress) => set({ progress }),
      resetProgress: () => set({ progress: initialProgress }),
      setReports: (reports: Report[]) => set({ reports }),
      addReport: (report: Report) => 
        set((state: ReportState) => ({ 
          reports: [report, ...state.reports]
        })),
      deleteReport: (reportId: string) => 
        set((state: ReportState) => ({
          reports: state.reports.filter((r: Report) => r.id !== reportId)
        })),
    }),
    {
      name: 'report-store',
      partialize: (state: ReportState) => ({
        formData: state.formData,
        isGenerating: state.isGenerating,
        reports: state.reports,
      }),
    }
  )
); 