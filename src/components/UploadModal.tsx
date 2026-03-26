import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Upload, FolderUp, FileUp } from 'lucide-react';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
  onFolderSelected: (files: FileList, folderName: string) => void;
}

export default function UploadModal({ open, onClose, onFileSelected, onFolderSelected }: UploadModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'folder'>('file');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (activeTab === 'file') {
      const file = e.dataTransfer.files?.[0];
      if (file) {
        onFileSelected(file);
        onClose();
      }
    } else {
      // Dropped items for folder - use dataTransfer.items for webkitGetAsEntry
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const entry = items[0].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // For directory drops, we need to traverse
          traverseDirectory(entry as FileSystemDirectoryEntry).then((files) => {
            if (files.length > 0) {
              const folderName = entry.name;
              const dt = new DataTransfer();
              files.forEach((f) => dt.items.add(f));
              onFolderSelected(dt.files, folderName);
              onClose();
            }
          });
        } else {
          // Single file dropped on folder tab
          const file = e.dataTransfer.files?.[0];
          if (file) {
            onFileSelected(file);
            onClose();
          }
        }
      }
    }
  }, [activeTab, onFileSelected, onFolderSelected, onClose]);

  const traverseDirectory = async (dirEntry: FileSystemDirectoryEntry): Promise<File[]> => {
    const files: File[] = [];

    const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
      new Promise((resolve, reject) => reader.readEntries(resolve, reject));

    const getFile = (entry: FileSystemFileEntry): Promise<File> =>
      new Promise((resolve, reject) => entry.file(resolve, reject));

    const processEntry = async (entry: FileSystemEntry, path: string) => {
      if (entry.isFile) {
        const file = await getFile(entry as FileSystemFileEntry);
        // Create a new File with the relative path
        const newFile = new File([file], file.name, { type: file.type, lastModified: file.lastModified });
        Object.defineProperty(newFile, 'webkitRelativePath', {
          value: `${path}/${file.name}`,
          writable: false,
        });
        files.push(newFile);
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        let entries: FileSystemEntry[] = [];
        let batch: FileSystemEntry[];
        do {
          batch = await readEntries(reader);
          entries = entries.concat(batch);
        } while (batch.length > 0);

        for (const child of entries) {
          await processEntry(child, `${path}/${entry.name}`);
        }
      }
    };

    const reader = dirEntry.createReader();
    let entries: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await readEntries(reader);
      entries = entries.concat(batch);
    } while (batch.length > 0);

    for (const entry of entries) {
      await processEntry(entry, dirEntry.name);
    }

    return files;
  };

  const handleBrowseFile = () => {
    fileInputRef.current?.click();
  };

  const handleBrowseFolder = () => {
    folderInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      onClose();
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const folderName = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] || 'folder';
    onFolderSelected(files, folderName);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select & Send</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'file' | 'folder')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="gap-2">
              <FileUp className="h-4 w-4" />
              File
            </TabsTrigger>
            <TabsTrigger value="folder" className="gap-2">
              <FolderUp className="h-4 w-4" />
              Folder
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
              className={`
                flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer
                ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}
              `}
              onClick={handleBrowseFile}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Drag & drop a file here, or <span className="text-primary font-medium">browse</span>
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </TabsContent>

          <TabsContent value="folder" className="mt-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
              className={`
                flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer
                ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}
              `}
              onClick={handleBrowseFolder}
            >
              <FolderUp className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Drag & drop a folder here, or <span className="text-primary font-medium">browse</span>
              </p>
              <p className="text-xs text-muted-foreground/70">Folder will be compressed before sending</p>
            </div>
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              onChange={handleFolderInputChange}
              {...({ webkitdirectory: 'true', directory: '' } as any)}
              multiple
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
