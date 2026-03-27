import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, FolderUp, FileUp } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface UploadModalProps {
  open: boolean;
  mode: 'file' | 'folder';
  onClose: () => void;
  onFileSelected: (file: File) => void;
  onFolderSelected: (files: FileList, folderName: string) => void;
}

export default function UploadModal({ open, mode, onClose, onFileSelected, onFolderSelected }: UploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // On mobile, skip the modal and directly trigger native picker
  useEffect(() => {
    if (open && isMobile) {
      // Small delay to ensure refs are mounted
      const timer = setTimeout(() => {
        if (mode === 'file') {
          fileInputRef.current?.click();
        } else {
          folderInputRef.current?.click();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, isMobile, mode]);

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

    if (mode === 'file') {
      const file = e.dataTransfer.files?.[0];
      if (file) {
        onFileSelected(file);
        onClose();
      }
    } else {
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const entry = items[0].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
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
          const file = e.dataTransfer.files?.[0];
          if (file) {
            onFileSelected(file);
            onClose();
          }
        }
      }
    }
  }, [mode, onFileSelected, onFolderSelected, onClose]);

  const traverseDirectory = async (dirEntry: FileSystemDirectoryEntry): Promise<File[]> => {
    const files: File[] = [];

    const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
      new Promise((resolve, reject) => reader.readEntries(resolve, reject));

    const getFile = (entry: FileSystemFileEntry): Promise<File> =>
      new Promise((resolve, reject) => entry.file(resolve, reject));

    const processEntry = async (entry: FileSystemEntry, path: string) => {
      if (entry.isFile) {
        const file = await getFile(entry as FileSystemFileEntry);
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
    } else if (isMobile) {
      // User cancelled the native picker on mobile
      onClose();
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      if (isMobile) onClose();
      return;
    }
    const folderName = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] || 'folder';
    onFolderSelected(files, folderName);
    onClose();
  };

  // Hidden inputs always rendered for mobile direct-trigger
  const hiddenInputs = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={handleFolderInputChange}
        {...({ webkitdirectory: 'true', directory: '' } as any)}
        multiple
      />
    </>
  );

  // On mobile, don't render the dialog — just the hidden inputs
  if (isMobile) {
    if (!open) return null;
    return hiddenInputs;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'file' ? 'Send a File' : 'Send a Folder'}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {mode === 'file' ? (
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
          ) : (
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
          )}
        </div>

        {hiddenInputs}
      </DialogContent>
    </Dialog>
  );
}
