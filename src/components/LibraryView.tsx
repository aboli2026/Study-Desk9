import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen,
  FileText,
  Trash2,
  Search,
  Play,
  Calendar,
  HardDrive,
  StickyNote,
  Edit3,
  Bookmark,
  AlertTriangle,
  Plus,
  Download,
  Loader2,
  Folder,
  FolderPlus,
  Tag,
  Star,
  MoreVertical,
  Check,
  X,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { StudyFile, FileCategory } from '../types';
import { getFileEditsFromStorage } from '../utils/fileStorage';
import { exportAnnotatedPdf } from '../utils/exportPdf';

interface LibraryViewProps {
  files: StudyFile[];
  onOpenFile: (file: StudyFile) => void;
  onDeleteFile: (id: string, fileName?: string) => void;
  onTriggerNewFile?: () => void;
  onUpdateFile?: (file: StudyFile) => void;
}

export const CATEGORY_COLOR_CONFIG: Record<
  string,
  { name: string; bg: string; text: string; border: string; dot: string; ring: string }
> = {
  blue: {
    name: 'آبی',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    ring: 'focus:ring-blue-500',
  },
  emerald: {
    name: 'زمردی',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    ring: 'focus:ring-emerald-500',
  },
  amber: {
    name: 'کهربایی',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    ring: 'focus:ring-amber-500',
  },
  violet: {
    name: 'بنفش',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    ring: 'focus:ring-purple-500',
  },
  rose: {
    name: 'رز',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    ring: 'focus:ring-rose-500',
  },
  cyan: {
    name: 'فیروزه‌ای',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
    ring: 'focus:ring-cyan-500',
  },
  orange: {
    name: 'نارنجی',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    ring: 'focus:ring-orange-500',
  },
  neutral: {
    name: 'دودی',
    bg: 'bg-neutral-100',
    text: 'text-neutral-700',
    border: 'border-neutral-200',
    dot: 'bg-neutral-500',
    ring: 'focus:ring-neutral-500',
  },
};

const DEFAULT_CATEGORIES: FileCategory[] = [
  { id: 'cat-university', name: 'دروس دانشگاهی', color: 'blue' },
  { id: 'cat-summaries', name: 'جزوات و خلاصه‌ها', color: 'emerald' },
  { id: 'cat-books', name: 'کتاب‌ها و مراجع', color: 'amber' },
  { id: 'cat-research', name: 'مقالات و پژوهش', color: 'violet' },
  { id: 'cat-exams', name: 'آزمون و کنکور', color: 'rose' },
];

const CATEGORIES_STORAGE_KEY = 'study_file_categories';

export const LibraryView: React.FC<LibraryViewProps> = ({
  files,
  onOpenFile,
  onDeleteFile,
  onTriggerNewFile,
  onUpdateFile,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [fileToDelete, setFileToDelete] = useState<StudyFile | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Categories state loaded from localStorage
  const [categories, setCategories] = useState<FileCategory[]>(() => {
    try {
      const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_CATEGORIES;
  });

  // Save categories on change
  useEffect(() => {
    try {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch {}
  }, [categories]);

  // Category Modal State (Add or Edit)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FileCategory | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryColorInput, setCategoryColorInput] = useState('blue');
  const [categoryToDelete, setCategoryToDelete] = useState<FileCategory | null>(null);

  // File Category Dropdown Popover Anchor
  const [activePickerFileId, setActivePickerFileId] = useState<string | null>(null);
  const pickerDropdownRef = useRef<HTMLDivElement | null>(null);

  // Category Submenu Dropdown Popover Anchor (زیرمجموعه کشویی دسته‌بندی‌ها)
  const [isCategorySubmenuOpen, setIsCategorySubmenuOpen] = useState(false);
  const categorySubmenuRef = useRef<HTMLDivElement | null>(null);

  // Close picker on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerDropdownRef.current && !pickerDropdownRef.current.contains(e.target as Node)) {
        setActivePickerFileId(null);
      }
      if (categorySubmenuRef.current && !categorySubmenuRef.current.contains(e.target as Node)) {
        setIsCategorySubmenuOpen(false);
      }
    };
    if (activePickerFileId || isCategorySubmenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [activePickerFileId, isCategorySubmenuOpen]);

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} بایت`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Deduplicate files by name to ensure no duplicates in library
  const uniqueFiles = useMemo(() => {
    const seen = new Set<string>();
    return files.filter((f) => {
      const key = (f.name || '').trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [files]);

  // Counts for each category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: uniqueFiles.length,
      favorites: uniqueFiles.filter((f) => f.isFavorite).length,
      uncategorized: uniqueFiles.filter((f) => !f.category).length,
    };
    for (const cat of categories) {
      counts[cat.id] = uniqueFiles.filter((f) => f.category === cat.id).length;
    }
    return counts;
  }, [uniqueFiles, categories]);

  // Filtered files according to category and search query
  const filteredFiles = useMemo(() => {
    let list = uniqueFiles;

    // 1. Filter by category
    if (selectedCategory === 'favorites') {
      list = list.filter((f) => f.isFavorite);
    } else if (selectedCategory === 'uncategorized') {
      list = list.filter((f) => !f.category);
    } else if (selectedCategory !== 'all') {
      list = list.filter((f) => f.category === selectedCategory);
    }

    // 2. Filter by search query
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((f) => {
        const nameMatch = (f.name || '').toLowerCase().includes(q);
        const tagMatch = (f.tags || []).some((t) => t.toLowerCase().includes(q));
        const catObj = categories.find((c) => c.id === f.category);
        const catMatch = catObj ? catObj.name.toLowerCase().includes(q) : false;
        return nameMatch || tagMatch || catMatch;
      });
    }

    // Sort: favorites first, then newest
    return list.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });
  }, [uniqueFiles, selectedCategory, searchQuery, categories]);

  const activeSelectedCat = categories.find((c) => c.id === selectedCategory);
  const activeCatCfg = activeSelectedCat
    ? CATEGORY_COLOR_CONFIG[activeSelectedCat.color] || CATEGORY_COLOR_CONFIG.blue
    : null;

  const handleConfirmDelete = () => {
    if (fileToDelete) {
      onDeleteFile(fileToDelete.id, fileToDelete.name);
      setFileToDelete(null);
    }
  };

  const handleExport = async (file: StudyFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!file.data) return;
    setExportingId(file.id);
    try {
      const edits = await getFileEditsFromStorage(file.id);
      await exportAnnotatedPdf({
        pdfData: file.originalData || file.data,
        fileName: file.name,
        pageStrokes: edits?.pageStrokes || file.pageStrokes || {},
        stickyNotes: edits?.stickyNotes || file.stickyNotes || [],
      });
    } catch (err) {
      console.error('Failed to export file from library:', err);
      alert('خطا در دانلود فایل ادیت‌شده.');
    } finally {
      setExportingId(null);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = (file: StudyFile, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...file, isFavorite: !file.isFavorite };
    if (onUpdateFile) {
      onUpdateFile(updated);
    }
  };

  // Assign category to file
  const handleAssignCategory = (file: StudyFile, categoryId: string | undefined) => {
    const updated: StudyFile = { ...file, category: categoryId || undefined };
    if (onUpdateFile) {
      onUpdateFile(updated);
    }
    setActivePickerFileId(null);
  };

  // Open modal to create a new category
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryNameInput('');
    setCategoryColorInput('blue');
    setIsCategoryModalOpen(true);
  };

  // Open modal to edit existing category
  const handleOpenEditCategory = (cat: FileCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setCategoryNameInput(cat.name);
    setCategoryColorInput(cat.color || 'blue');
    setIsCategoryModalOpen(true);
  };

  // Save new or edited category
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = categoryNameInput.trim();
    if (!name) return;

    if (editingCategory) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategory.id ? { ...c, name, color: categoryColorInput } : c
        )
      );
    } else {
      const newCat: FileCategory = {
        id: `cat-${Date.now()}`,
        name,
        color: categoryColorInput,
        createdAt: new Date().toISOString(),
      };
      setCategories((prev) => [...prev, newCat]);
    }
    setIsCategoryModalOpen(false);
  };

  // Delete a category
  const handleConfirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    const catId = categoryToDelete.id;

    // Remove category from files (make them uncategorized)
    if (onUpdateFile) {
      uniqueFiles.forEach((file) => {
        if (file.category === catId) {
          onUpdateFile({ ...file, category: undefined });
        }
      });
    }

    setCategories((prev) => prev.filter((c) => c.id !== catId));
    if (selectedCategory === catId) {
      setSelectedCategory('all');
    }
    setCategoryToDelete(null);
  };

  const getCategoryObj = (catId?: string) => {
    if (!catId) return null;
    return categories.find((c) => c.id === catId) || null;
  };

  return (
    <div
      className="h-full flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto bg-neutral-50/60 select-none"
      dir="rtl"
    >
      <div className="max-w-4xl w-full mx-auto space-y-4 sm:space-y-5">
        {/* Apple-style In-App Delete File Confirmation Dialog */}
        {fileToDelete && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setFileToDelete(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200/80 space-y-5 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                  حذف فایل از کتابخانه
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                  آیا از حذف فایل{' '}
                  <span className="font-bold text-neutral-800">«{fileToDelete.name}»</span> از
                  کتابخانه اطمینان دارید؟
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFileToDelete(null)}
                  className="flex-1 py-2.5 px-4 text-xs sm:text-sm font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>بله، حذف شود</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Category Confirmation Dialog */}
        {categoryToDelete && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setCategoryToDelete(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200/80 space-y-5 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Folder className="w-6 h-6" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-base font-bold text-neutral-900">
                  حذف دسته‌بندی «{categoryToDelete.name}»
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  با حذف این دسته، فایل‌های داخل آن حذف نخواهند شد و تنها به حالت «بدون دسته‌بندی» منتقل می‌شوند.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCategory}
                  className="flex-1 py-2 px-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer shadow-sm"
                >
                  حذف دسته‌بندی
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create / Edit Category Modal */}
        {isCategoryModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsCategoryModalOpen(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-neutral-200/80 space-y-4 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                    <FolderPlus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    {editingCategory ? 'ویرایش دسته‌بندی' : 'ایجاد دسته‌بندی جدید'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                    نام دسته‌بندی:
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="مثلاً: ریاضی مهندسی، زیست‌شناسی، رفرنس‌ها..."
                    value={categoryNameInput}
                    onChange={(e) => setCategoryNameInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-2">
                    رنگ برچسب:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(CATEGORY_COLOR_CONFIG).map(([colorKey, cfg]) => {
                      const isSelected = categoryColorInput === colorKey;
                      return (
                        <button
                          key={colorKey}
                          type="button"
                          onClick={() => setCategoryColorInput(colorKey)}
                          className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                            cfg.bg
                          } ${cfg.text} ${
                            isSelected
                              ? 'ring-2 ring-neutral-900 border-neutral-400 shadow-xs'
                              : 'border-transparent hover:opacity-85'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                          <span className="text-[11px] truncate">{cfg.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="flex-1 py-2.5 text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl cursor-pointer shadow-xs"
                  >
                    {editingCategory ? 'ثبت تغییرات' : 'ایجاد دسته'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Minimal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-neutral-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="p-1.5 rounded-xl bg-neutral-900 text-white shadow-xs">
                <BookOpen className="w-4 h-4" />
              </span>
              <h1 className="text-base sm:text-xl font-bold text-neutral-900">
                کتابخانه و دسته‌بندی فایل‌ها
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-500">
              مدیریت جزوات، دسته‌بندی‌های موضوعی، برگزیده‌ها و پیگیری پیشرفت مطالعه
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs font-mono font-semibold text-neutral-600 bg-neutral-100 px-3 py-1.5 rounded-xl border border-neutral-200/60">
              {uniqueFiles.length} فایل
            </span>
            <button
              type="button"
              onClick={handleOpenAddCategory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl cursor-pointer ios-spring-btn border border-neutral-200/70"
              title="ایجاد دسته موضوعی جدید"
            >
              <FolderPlus className="w-3.5 h-3.5 text-neutral-600" />
              <span>دسته جدید</span>
            </button>
            {onTriggerNewFile && (
              <button
                type="button"
                onClick={onTriggerNewFile}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl cursor-pointer ios-spring-btn shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>فایل جدید</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {uniqueFiles.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="جستجوی عنوان فایل، نام درس یا دسته‌بندی..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-white border border-neutral-200/80 rounded-2xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white shadow-xs transition-all"
            />
          </div>
        )}

        {/* Compact Submenu Filter Strip (دسته‌بندی‌ها در زیرمجموعه کشویی برای جلوگیری از شلوغی صفحه) */}
        {uniqueFiles.length > 0 && (
          <div
            className={`flex items-center justify-between gap-2 bg-white/90 backdrop-blur-xs p-1.5 sm:p-2 rounded-2xl border border-neutral-200/80 shadow-2xs select-none relative ${
              isCategorySubmenuOpen ? 'z-40' : 'z-20'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap flex-1">
              {/* 1. All Files (همه فایل‌ها) */}
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ios-spring-btn shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>همه فایل‌ها</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    selectedCategory === 'all' ? 'bg-neutral-700 text-white' : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {categoryCounts.all}
                </span>
              </button>

              {/* 2. Favorites (برگزیده‌ها ⭐) */}
              <button
                type="button"
                onClick={() => setSelectedCategory('favorites')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ios-spring-btn shrink-0 ${
                  selectedCategory === 'favorites'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-amber-50/70 hover:text-amber-800'
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 shrink-0 ${
                    selectedCategory === 'favorites' ? 'fill-current text-white' : 'text-amber-500'
                  }`}
                />
                <span>برگزیده‌ها</span>
                {categoryCounts.favorites > 0 && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      selectedCategory === 'favorites' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {categoryCounts.favorites}
                  </span>
                )}
              </button>

              {/* Divider */}
              <div className="w-px h-4 bg-neutral-200 shrink-0 hidden sm:block" />

              {/* 3. Category Submenu Dropdown (زیرمجموعه کشویی دسته‌بندی‌ها) */}
              <div className="relative shrink-0" ref={categorySubmenuRef}>
                <button
                  type="button"
                  onClick={() => setIsCategorySubmenuOpen(!isCategorySubmenuOpen)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ios-spring-btn shrink-0 ${
                    activeSelectedCat && activeCatCfg
                      ? `${activeCatCfg.bg} ${activeCatCfg.text} ${activeCatCfg.border} shadow-2xs`
                      : selectedCategory === 'uncategorized'
                      ? 'bg-neutral-100 text-neutral-800 border-neutral-300'
                      : isCategorySubmenuOpen
                      ? 'bg-neutral-100 text-neutral-900 border-neutral-300'
                      : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200/90'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 shrink-0" />
                  {activeSelectedCat && activeCatCfg ? (
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${activeCatCfg.dot}`} />
                      <span>دسته: {activeSelectedCat.name}</span>
                    </span>
                  ) : selectedCategory === 'uncategorized' ? (
                    <span>دسته‌بندی‌نشده</span>
                  ) : (
                    <span>زیرمجموعه دسته‌بندی‌ها</span>
                  )}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 opacity-60 ${
                      isCategorySubmenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Submenu Dropdown Popover with global iOS jelly animation */}
                {isCategorySubmenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white rounded-2xl border border-neutral-200 shadow-2xl p-2 z-50 animate-ios-jelly origin-top-right select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-2 px-2 border-b border-neutral-100 mb-1">
                      <span className="text-[11px] font-bold text-neutral-500">
                        انتخاب دسته‌بندی
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCategorySubmenuOpen(false);
                          handleOpenAddCategory();
                        }}
                        className="text-[11px] font-bold text-neutral-800 hover:text-black flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>دسته جدید</span>
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 py-1">
                      {/* Option to clear category filter */}
                      {selectedCategory !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('all');
                            setIsCategorySubmenuOpen(false);
                          }}
                          className="w-full text-right px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50/70 hover:bg-rose-100/80 rounded-xl flex items-center justify-between border border-rose-200 transition-colors cursor-pointer mb-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            <span>حذف فیلتر دسته‌بندی (نمایش همه)</span>
                          </div>
                          <X className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                      )}

                      {/* All Categories Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('all');
                          setIsCategorySubmenuOpen(false);
                        }}
                        className={`w-full text-right px-2.5 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-neutral-100 cursor-pointer transition-colors ${
                          selectedCategory === 'all'
                            ? 'font-bold bg-neutral-100 text-neutral-900'
                            : 'text-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                          <span>همه دسته‌بندی‌ها</span>
                        </div>
                        {selectedCategory === 'all' && (
                          <Check className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                        )}
                      </button>

                      {/* Categories List */}
                      {categories.map((cat) => {
                        const cfg = CATEGORY_COLOR_CONFIG[cat.color] || CATEGORY_COLOR_CONFIG.blue;
                        const isCurrent = selectedCategory === cat.id;
                        const count = categoryCounts[cat.id] || 0;

                        return (
                          <div
                            key={cat.id}
                            className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors ${
                              isCurrent ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategory(cat.id);
                                setIsCategorySubmenuOpen(false);
                              }}
                              className="flex items-center gap-2 min-w-0 flex-1 text-right text-xs cursor-pointer py-0.5"
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0`} />
                              <span
                                className={`truncate ${
                                  isCurrent ? 'font-bold text-neutral-900' : 'text-neutral-700'
                                }`}
                              >
                                {cat.name}
                              </span>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                                  isCurrent
                                    ? 'bg-neutral-900 text-white'
                                    : `${cfg.bg} ${cfg.text} border ${cfg.border}`
                                }`}
                              >
                                {count}
                              </span>

                              {/* Edit Trigger */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditCategory(cat, e);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200 rounded-md transition-opacity cursor-pointer"
                                title="ویرایش دسته"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>

                              {/* Delete Trigger */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCategoryToDelete(cat);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-opacity cursor-pointer"
                                title="حذف دسته"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Uncategorized files option */}
                      {categoryCounts.uncategorized > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('uncategorized');
                            setIsCategorySubmenuOpen(false);
                          }}
                          className={`w-full text-right px-2.5 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-neutral-100 cursor-pointer transition-colors ${
                            selectedCategory === 'uncategorized'
                              ? 'font-bold bg-neutral-100 text-neutral-900'
                              : 'text-neutral-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-neutral-300" />
                            <span>دسته‌بندی‌نشده</span>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-neutral-100 text-neutral-500 font-bold">
                            {categoryCounts.uncategorized}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Reset Filter Button */}
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  title="نمایش مجدد همه فایل‌ها"
                >
                  <X className="w-3 h-3" />
                  <span>نمایش همه</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {uniqueFiles.length === 0 ? (
          <div className="p-10 sm:p-14 bg-white border border-neutral-200/80 rounded-3xl text-center flex flex-col items-center justify-center shadow-xs space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-700">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                کتابخانه هنوز خالی است
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                با انتخاب هر فایل PDF، فایل به صورت خودکار با تمام یادداشت‌ها، دسته‌بندی‌ها و صفحه جاری در این
                لیست قرار می‌گیرد.
              </p>
            </div>
            {onTriggerNewFile && (
              <button
                type="button"
                onClick={onTriggerNewFile}
                className="mt-2 px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl cursor-pointer ios-spring-btn shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>انتخاب اولین فایل</span>
              </button>
            )}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-8 bg-white border border-neutral-200/80 rounded-2xl text-center text-xs text-neutral-500 space-y-2">
            <div>
              فایلی در دسته‌بندی انتخاب‌شده {searchQuery ? `یا با عنوان «${searchQuery}»` : ''} پیدا نشد.
            </div>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="text-xs font-bold text-neutral-900 underline cursor-pointer"
              >
                مشاهده همه فایل‌ها
              </button>
            )}
          </div>
        ) : (
          /* ========================================================
             FILES LIST WITH CATEGORY BADGES AND ONE-CLICK ACTIONS
             ======================================================== */
          <div className="flex flex-col space-y-2.5">
            {filteredFiles.map((file) => {
              const sizeText = formatFileSize(file.size);
              const hasNotes = file.stickyNotes && file.stickyNotes.length > 0;
              const hasDrawings =
                file.pageStrokes && Object.values(file.pageStrokes).some((s) => s.length > 0);

              const currentPage = file.currentPage && file.currentPage > 0 ? file.currentPage : 1;
              const pageCount = file.pageCount && file.pageCount > 0 ? file.pageCount : 0;
              const percent = pageCount > 0 ? Math.min(100, Math.round((currentPage / pageCount) * 100)) : 0;
              const isCompleted = pageCount > 0 && currentPage >= pageCount;

              const fileCategory = getCategoryObj(file.category);
              const categoryColorCfg = fileCategory
                ? CATEGORY_COLOR_CONFIG[fileCategory.color] || CATEGORY_COLOR_CONFIG.blue
                : null;

              const isPickerOpen = activePickerFileId === file.id;

              return (
                <div
                  key={file.id}
                  onClick={() => onOpenFile(file)}
                  className={`bg-white rounded-2xl border border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50/50 py-3.5 px-3.5 sm:px-4 shadow-2xs hover:shadow-xs transition-colors transition-shadow flex flex-col gap-2.5 group cursor-pointer relative ${
                    isPickerOpen ? 'z-40' : 'z-10'
                  }`}
                >
                  {/* Top Row: File Icon + Title + Category Pill + Actions */}
                  <div className="flex items-center justify-between gap-3 w-full">
                    {/* Right Side: Icon + Name + Category + Tags */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Compact Document Icon */}
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>

                      {/* Prominent Name & Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {/* Favorite Star Button */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavorite(file, e)}
                            className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                              file.isFavorite
                                ? 'text-amber-500 hover:text-amber-600'
                                : 'text-neutral-300 hover:text-amber-400 opacity-60 group-hover:opacity-100'
                            }`}
                            title={file.isFavorite ? 'حذف از برگزیده‌ها' : 'افزودن به برگزیده‌ها'}
                          >
                            <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-current' : ''}`} />
                          </button>

                          <h3
                            className="text-xs sm:text-sm font-bold text-neutral-900 truncate group-hover:text-black select-text"
                            title={file.name}
                          >
                            {file.name}
                          </h3>

                          {/* Category Badge with Quick Clear & Selector */}
                          <div className="relative shrink-0">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePickerFileId(isPickerOpen ? null : file.id);
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 border transition-all cursor-pointer ios-spring-btn ${
                                  fileCategory && categoryColorCfg
                                    ? `${categoryColorCfg.bg} ${categoryColorCfg.text} ${categoryColorCfg.border}`
                                    : 'bg-neutral-100 text-neutral-500 border-neutral-200/80 hover:bg-neutral-200/70'
                                }`}
                                title="تغییر یا انتخاب دسته‌بندی فایل"
                              >
                                {fileCategory && categoryColorCfg && (
                                  <span className={`w-1.5 h-1.5 rounded-full ${categoryColorCfg.dot}`} />
                                )}
                                <span>{fileCategory ? fileCategory.name : '+ افزودن دسته'}</span>
                                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                              </button>

                              {/* Quick 1-Click Clear Category Button right on badge */}
                              {file.category && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAssignCategory(file, undefined);
                                  }}
                                  className="w-4 h-4 rounded-full bg-neutral-100 hover:bg-rose-100 text-neutral-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                                  title="حذف دسته‌بندی این فایل"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>

                            {/* Apple-style Category Selector Popover Dropdown with global iOS jelly animation */}
                            {isPickerOpen && (
                              <div
                                ref={pickerDropdownRef}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1.5 w-52 sm:w-56 bg-white rounded-2xl border border-neutral-200 shadow-2xl p-2 z-50 animate-ios-jelly origin-top-right select-none"
                              >
                                <div className="px-2.5 py-1 text-[10px] font-bold text-neutral-400 border-b border-neutral-100 flex items-center justify-between mb-1.5">
                                  <span>انتخاب دسته‌بندی فایل</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePickerFileId(null);
                                      handleOpenAddCategory();
                                    }}
                                    className="text-neutral-800 hover:text-black flex items-center gap-0.5 bg-neutral-100 hover:bg-neutral-200 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>جدید</span>
                                  </button>
                                </div>

                                <div className="max-h-56 overflow-y-auto space-y-1">
                                  {/* Dedicated Option to Clear/Remove Category from this file */}
                                  {file.category && (
                                    <button
                                      type="button"
                                      onClick={() => handleAssignCategory(file, undefined)}
                                      className="w-full text-right px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50/70 hover:bg-rose-100/80 rounded-xl flex items-center justify-between border border-rose-200 transition-colors cursor-pointer mb-1.5"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                        <span>حذف دسته‌بندی این فایل</span>
                                      </div>
                                      <X className="w-3.5 h-3.5 text-rose-500" />
                                    </button>
                                  )}

                                  {/* Remove Category / Uncategorized Default option if not set */}
                                  <button
                                    type="button"
                                    onClick={() => handleAssignCategory(file, undefined)}
                                    className={`w-full text-right px-2.5 py-1.5 text-xs rounded-xl flex items-center justify-between hover:bg-neutral-100 cursor-pointer transition-colors ${
                                      !file.category ? 'font-bold text-neutral-900 bg-neutral-100' : 'text-neutral-600'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-neutral-300" />
                                      <span>بدون دسته‌بندی</span>
                                    </div>
                                    {!file.category && <Check className="w-3.5 h-3.5 text-neutral-800" />}
                                  </button>

                                  {/* List Categories */}
                                  {categories.map((c) => {
                                    const cfg = CATEGORY_COLOR_CONFIG[c.color] || CATEGORY_COLOR_CONFIG.blue;
                                    const isCurrent = file.category === c.id;
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleAssignCategory(file, c.id)}
                                        className={`w-full text-right px-2.5 py-1.5 text-xs rounded-xl flex items-center justify-between hover:bg-neutral-100 cursor-pointer transition-colors ${
                                          isCurrent ? 'font-bold text-neutral-900 bg-neutral-100' : 'text-neutral-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
                                          <span className="truncate">{c.name}</span>
                                        </div>
                                        {isCurrent && <Check className="w-3.5 h-3.5 text-neutral-800 shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Page Bookmark Tag */}
                          {file.currentPage && file.currentPage > 1 && (
                            <span className="shrink-0 text-[10px] font-bold text-neutral-700 bg-neutral-100 border border-neutral-200/70 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                              <Bookmark className="w-2.5 h-2.5 text-neutral-500" />
                              <span>صفحه {file.currentPage}</span>
                            </span>
                          )}
                        </div>

                        {/* Tiny Metadata Row */}
                        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-neutral-400 mt-1 font-mono flex-wrap">
                          {sizeText && (
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-2.5 h-2.5" />
                              <span>{sizeText}</span>
                            </span>
                          )}

                          {file.uploadDate && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                <span>{file.uploadDate}</span>
                              </span>
                            </>
                          )}

                          {hasNotes && (
                            <>
                              <span>·</span>
                              <span className="text-amber-700 flex items-center gap-0.5 font-sans font-medium">
                                <StickyNote className="w-2.5 h-2.5" />
                                <span>{file.stickyNotes?.length} یادداشت</span>
                              </span>
                            </>
                          )}

                          {hasDrawings && (
                            <>
                              <span>·</span>
                              <span className="text-sky-700 flex items-center gap-0.5 font-sans font-medium">
                                <Edit3 className="w-2.5 h-2.5" />
                                <span>نشانه‌دار</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Left Side: Dedicated "ادامه مطالعه" Button + Download + Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFile(file);
                        }}
                        className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-[11px] sm:text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all ios-spring-btn shrink-0"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>ادامه مطالعه</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleExport(file, e)}
                        disabled={exportingId === file.id}
                        className="p-1.5 sm:p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                        title="دانلود نسخه PDF با تمام ادیت‌ها و هایلایت‌ها"
                      >
                        {exportingId === file.id ? (
                          <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-neutral-700" />
                        ) : (
                          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFileToDelete(file);
                        }}
                        className="p-1.5 sm:p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                        title="حذف از کتابخانه"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Minimal Reading Progress Bar */}
                  <div className="pt-2 border-t border-neutral-100/90 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                      <span className="flex items-center gap-1 text-neutral-600 font-sans">
                        <span className="text-neutral-400">پیشرفت:</span>
                        {pageCount > 0 ? (
                          <span className="font-bold text-neutral-800 font-mono">
                            صفحه {currentPage} از {pageCount}
                          </span>
                        ) : (
                          <span className="font-medium text-neutral-700 font-mono">
                            صفحه {currentPage}
                          </span>
                        )}
                      </span>

                      <span
                        className={`font-bold tabular-nums flex items-center gap-1 ${
                          isCompleted
                            ? 'text-emerald-600'
                            : percent > 0
                            ? 'text-neutral-800'
                            : 'text-neutral-400'
                        }`}
                      >
                        {isCompleted ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-1.5 py-0.5 rounded font-sans text-[10px]">
                            تکمیل شد ۱۰۰٪ ✓
                          </span>
                        ) : pageCount > 0 ? (
                          `${percent}٪`
                        ) : (
                          'آماده مطالعه'
                        )}
                      </span>
                    </div>

                    {/* Slender Minimal Track & Fill */}
                    <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          isCompleted
                            ? 'bg-emerald-500'
                            : percent > 0
                            ? 'bg-neutral-800 group-hover:bg-neutral-900'
                            : 'bg-neutral-200'
                        }`}
                        style={{
                          width: pageCount > 0 ? `${percent}%` : '4%',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
