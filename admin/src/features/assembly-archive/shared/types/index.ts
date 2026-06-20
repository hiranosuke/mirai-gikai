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
