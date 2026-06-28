export type Cabinet = {
  cabinetId: number;
  name: string;
};

export type FolderNode = {
  kind: "folder";
  cabinetId: number;
  folderId: number;
  name: string;
};

export type DocumentNode = {
  kind: "document";
  cabinetId: number;
  folderId: number;
  docid: number;
  title: string;
  date: string;
};

export type TreeChild = FolderNode | DocumentNode;

export type DocumentFile = {
  fileId: number;
  fileName: string;
};

export type DocumentDetail = {
  title: string;
  folderPath: string;
  bodyText: string;
  files: DocumentFile[];
};

export type ParsedFolderList = {
  folders: { folderId: number; name: string }[];
  documents: { docid: number; title: string; date: string }[];
};

export type ParsedDocView = {
  title: string;
  folderPath: string;
  bodyText: string;
  files: DocumentFile[];
};

export type SelectedFile = {
  doc: DocumentNode;
  fileId: number;
  fileName: string;
};

export type AssemblyFolderRow = {
  folder_id: number;
  cabinet_id: number;
  parent_folder_id: number | null;
  name: string;
  path: string;
};

export type AssemblyDocumentRow = {
  cabinet_id: number;
  folder_id: number;
  docid: number;
  title: string;
  doc_date: string | null;
  raw_date: string;
  folder_path: string;
  session_label: string | null;
};

export type AssemblySearchInput = {
  query?: string;
  sessionLabel?: string;
  cabinetId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export type AssemblySearchResult = {
  title: string;
  docDate: string | null;
  folderPath: string;
  sessionLabel: string | null;
  cabinetId: number;
  folderId: number;
  docid: number;
};
