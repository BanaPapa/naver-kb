export interface WeeklyDataRow {
  id: number;
  date: string;
  region: string;
  saleChange: number | null;
  jeonseChange: number | null;
  saleIndex: number | null;
  jeonseIndex: number | null;
  buyerAdvantage: number | null;
  saleActivity: number | null;
  jeonseSupply: number | null;
  jeonseActivity: number | null;
}

export interface CollectionLog {
  id: number;
  dataType: string;
  fileName: string;
  status: string;
  recordCount: number | null;
  errorMsg: string | null;
  createdAt: string;
}

export interface CollectionStatus {
  logs: CollectionLog[];
  latestDate: string | null;
  totalRecords: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
