/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, FolderUp, FileUp, ChevronRight, ChevronDown, FileText, FolderIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface UploadModalProps {
  open: boolean;
  mode: 'file' | 'folder';
  onClose: () => void;
  onFileSelected: (files: File[]) => void;
  onFolderSelected: (files: FileList, folderName: string) => void;
}

export default function UploadModal({ open, mode, onClose, onFileSelected, onFolderSelected }: UploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
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
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFileSelected(files);
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
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) {
            onFileSelected(files);
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
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
      setShowConfirmation(true);
    } else if (isMobile) {
      onClose();
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      if (isMobile) onClose();
      return;
    }
    setSelectedFiles(Array.from(files));
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    if (selectedFiles.length === 0) return;
    
    if (mode === 'folder' || selectedFiles.length > 1) {
      const folderName = (selectedFiles[0] as any).webkitRelativePath?.split('/')[0] || 'folder';
      // Create a FileList-like structure or just pass the array if onFolderSelected can handle it
      // Actually, let's just use onFileSelected for everything now since it handles zipping in Room.tsx
      onFileSelected(selectedFiles);
    } else {
      onFileSelected([selectedFiles[0]]);
    }
    
    setSelectedFiles([]);
    setShowConfirmation(false);
    onClose();
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    setShowConfirmation(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper for tree building
  const getFileTree = (files: File[]) => {
    const root: any = { name: 'Root', children: {}, type: 'folder' };
    files.forEach(file => {
      const path = (file as any).webkitRelativePath || file.name;
      const parts = path.split('/');
      let current = root;
      parts.forEach((part, i) => {
        if (!current.children[part]) {
          current.children[part] = { 
            name: part, 
            children: {}, 
            type: i === parts.length - 1 ? 'file' : 'folder',
            size: i === parts.length - 1 ? file.size : 0
          };
        }
        if (i === parts.length - 1) {
          current.children[part].size = file.size;
        }
        current = current.children[part];
      });
    });
    return root;
  };

  const TreeItem = ({ item, level = 0 }: { item: any, level?: number }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = Object.keys(item.children).length > 0;

    return (
      <div className="select-none">
        <div 
          className="flex items-center gap-1.5 py-1 px-2 hover:bg-accent/50 rounded cursor-pointer transition-colors"
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-3 w-3 opacity-60" /> : <ChevronRight className="h-3 w-3 opacity-60" />
          ) : (
            <div className="w-3" />
          )}
          {item.type === 'folder' ? (
            <FolderIcon className="h-3.5 w-3.5 text-primary/70" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-blue-500/70" />
          )}
          <span className="text-xs truncate max-w-[180px]">{item.name}</span>
          {item.type === 'file' && (
            <span className="ml-auto text-[9px] opacity-40 font-mono">{formatSize(item.size)}</span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {Object.values(item.children).map((child: any, idx) => (
              <TreeItem key={idx} item={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Hidden inputs always rendered for mobile direct-trigger
  const hiddenInputs = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
        multiple
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
          {showConfirmation ? (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-bottom flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Payload Structure</span>
                  <span className="text-[10px] font-mono opacity-40">{selectedFiles.length} items</span>
                </div>
                <div className="max-h-60 overflow-y-auto p-2 custom-scrollbar bg-card/40">
                  <TreeItem item={getFileTree(selectedFiles)} />
                </div>
              </div>
              
              <div className="text-center space-y-4 pt-2">
                <p className="text-xs font-medium text-muted-foreground px-4">
                  Are you sure you want to transfer {selectedFiles.length === 1 ? 'this file' : 'these items as a zipped package'}?
                </p>
                <div className="flex gap-3 px-2 pb-2">
                  <button 
                    onClick={handleCancel}
                    className="flex-1 h-11 px-4 text-xs font-bold uppercase tracking-widest rounded-xl border border-border hover:bg-muted transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirm}
                    className="flex-1 h-11 px-4 text-xs font-black uppercase tracking-widest rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
                  >
                    Start Transfer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
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
                    Drag & drop files here, or <span className="text-primary font-medium">browse</span>
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
                  <p className="text-xs text-muted-foreground/70 text-center">Folders will be zipped as one package</p>
                </div>
              )}
            </>
          )}
        </div>

        {hiddenInputs}
      </DialogContent>
    </Dialog>
  );
}
