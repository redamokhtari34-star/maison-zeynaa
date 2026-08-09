import React, { useState, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Minus,
  Edit3, 
  Sparkles, 
  Upload, 
  X, 
  Tag, 
  CheckCircle, 
  AlertTriangle, 
  Wrench,
  ChevronRight,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { Dress, DressCategory, DressStatus, Language, Reservation } from '../types';
import { translations } from '../translations';
import { addHistoryEntry, getSupabaseClient, mapDressToDb, uploadImageToSupabase, ensurePublicUrl } from '../lib/storage';
import { todayIso } from '../lib/dates';
import { notifyError, notifySuccess } from '../lib/toast';
import { mirrorToCloud } from '../lib/sync';
import { askConfirm } from '../lib/confirm';

const LOCAL_SYNC_FAIL = "Modification enregistrée sur cet appareil, "
  + "mais la synchronisation avec le cloud a échoué.";

interface RobesProps {
  dresses: Dress[];
  onSaveDresses: (dresses: Dress[]) => void;
  language: Language;
  initialOpenForm?: boolean;
  onFormOpenHandled?: () => void;
  onRefreshData?: () => void;
  reservations?: Reservation[];
}

export default function Robes({
  dresses,
  onSaveDresses,
  language,
  initialOpenForm,
  onFormOpenHandled,
  onRefreshData,
  reservations = []
}: RobesProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');

  // Form Drawer state
  const [isFormOpen, setIsFormOpen] = useState(initialOpenForm || false);

  React.useEffect(() => {
    if (initialOpenForm) {
      setIsFormOpen(true);
      onFormOpenHandled?.();
    }
  }, [initialOpenForm, onFormOpenHandled]);
  const [editingDress, setEditingDress] = useState<Dress | null>(null);

  // Form Fields state
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState<DressCategory>('caftan');
  const [couleur, setCouleur] = useState('');
  const [taille, setTaille] = useState('');
  const [prix, setPrix] = useState<number>(15000);
  const [caution, setCaution] = useState<number>(10000);
  const [description, setDescription] = useState('');
  const [photoMain, setPhotoMain] = useState('');
  const [photosList, setPhotosList] = useState<string[]>([]);
  const [statut, setStatut] = useState<DressStatus>('disponible');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Categories helper
  const categoriesList: Array<{ id: DressCategory; label: string }> = [
    { id: 'caftan', label: language === 'fr' ? 'Caftan' : 'قفطان' },
    { id: 'karakou', label: language === 'fr' ? 'Karakou' : 'كاراكو' },
    { id: 'chaouia', label: language === 'fr' ? 'Robe Chaouia' : 'ملحفة شاوية' },
    { id: 'kabyle', label: language === 'fr' ? 'Robe Kabyle' : 'جبة قبائلية' },
    { id: 'badroune', label: language === 'fr' ? 'Badroune' : 'بدرون' },
    { id: 'soiree', label: language === 'fr' ? 'Robe de Soirée' : 'فستان سهرة' },
    { id: 'autre', label: language === 'fr' ? 'Autre' : 'آخر' }
  ];

  // Drag & Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const processFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsUploadingImage(true);
    setUploadProgress({ current: 0, total: files.length });

    try {
      let currentMain = photoMain;
      const newSecondaryPhotos: string[] = [];

      // Sequential upload loop (for...of) to avoid network saturation
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });

        try {
          const publicUrl = await uploadImageToSupabase(file, 'robes');
          if (!currentMain) {
            currentMain = publicUrl;
            setPhotoMain(publicUrl);
          } else {
            newSecondaryPhotos.push(publicUrl);
          }
        } catch (err: any) {
          console.error(`Erreur d'envoi de l'image ${i + 1}/${files.length} sur Supabase Storage:`, err);
          notifyError(`Erreur lors de l'envoi de l'image (${file.name}) : ` + (err.message || err));

          // Sequential fallback read base64 if upload failed
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => resolve((uploadEvent.target?.result as string) || '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
          });

          if (base64 && !base64.startsWith('blob:')) {
            if (!currentMain) {
              currentMain = base64;
              setPhotoMain(base64);
            } else {
              newSecondaryPhotos.push(base64);
            }
          }
        }
      }

      if (newSecondaryPhotos.length > 0) {
        setPhotosList(prev => [...prev, ...newSecondaryPhotos]);
      }
    } finally {
      setIsUploadingImage(false);
      setUploadProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  // Open Form
  const openAddForm = () => {
    setEditingDress(null);
    setNom('');
    setCategorie('caftan');
    setCouleur('');
    setTaille('');
    setPrix(15000);
    setCaution(10000);
    setDescription('');
    setPhotoMain('');
    setPhotosList([]);
    setStatut('disponible');
    setIsFormOpen(true);
  };


  // Set exactly 70 dresses

  const openEditForm = (dress: Dress, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDress(dress);
    setNom(dress.nom);
    setCategorie(dress.categorie);
    setCouleur(dress.couleur);
    setTaille(dress.taille);
    setPrix(dress.prix_location_da);
    setCaution(dress.caution_da);
    setDescription(dress.description);
    setPhotoMain(dress.photo_principale);
    setPhotosList(dress.photos || []);
    setStatut(dress.statut);
    setIsFormOpen(true);
  };

  // Delete Dress
  const handleDelete = async (dressId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const dress = dresses.find(d => d.id === dressId);
    if (!dress) return;

    const msg = language === 'fr' 
      ? `Êtes-vous sûr de vouloir supprimer la robe "${dress.nom}" ?`
      : `هل أنت متأكد من حذف فستان "${dress.nom}"؟`;

    if (await askConfirm({ title: language === 'fr' ? 'Supprimer la robe' : 'حذف الفستان', message: msg, danger: true, confirmLabel: language === 'fr' ? 'Supprimer' : 'حذف', cancelLabel: language === 'fr' ? 'Annuler' : 'إلغاء' })) {
      const supabase = getSupabaseClient();
      if (supabase) {
        mirrorToCloud(() => supabase.from('robes').delete().eq('id', dressId), LOCAL_SYNC_FAIL);
      }

      const updated = dresses.filter(d => d.id !== dressId);
      onSaveDresses(updated);
      addHistoryEntry(
        language === 'fr' ? 'Suppression de robe' : 'حذف فستان',
        `La robe "${dress.nom}" (ID: ${dress.id}) a été retirée de l'inventaire.`
      );
    }
  };

  // Quick state toggle
  const toggleMaintenance = async (dressId: string, currentStatut: DressStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetStatus: DressStatus = currentStatut === 'en_entretien' ? 'disponible' : 'en_entretien';
    
    const supabase = getSupabaseClient();
    if (supabase) {
      mirrorToCloud(() => supabase.from('robes').update({ statut: targetStatus }).eq('id', dressId), LOCAL_SYNC_FAIL);
    }

    const updated = dresses.map(d => {
      if (d.id === dressId) {
        return { ...d, statut: targetStatus };
      }
      return d;
    });
    onSaveDresses(updated);

    const dress = dresses.find(d => d.id === dressId);
    if (dress) {
      addHistoryEntry(
        language === 'fr' ? 'Entretien robe' : 'صيانة فستان',
        `La robe "${dress.nom}" a été placée en statut "${targetStatus}".`
      );
    }
  };

  // Save form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !couleur || !taille) {
      notifyError(language === 'fr' ? 'Veuillez remplir les champs obligatoires' : 'يرجى ملء الحقول الإجبارية');
      return;
    }

    const defaultPhoto = 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600';
    let finalPhoto = photoMain || defaultPhoto;

    if (finalPhoto.startsWith('blob:')) {
      try {
        finalPhoto = await ensurePublicUrl(finalPhoto, 'robes');
      } catch {
        finalPhoto = defaultPhoto;
      }
    }
    if (!finalPhoto || finalPhoto.startsWith('blob:')) {
      finalPhoto = defaultPhoto;
    }

    const supabase = getSupabaseClient();

    if (editingDress) {
      // Modify
      const updatedDressObj: Dress = {
        ...editingDress,
        nom,
        categorie,
        couleur,
        taille,
        prix_location_da: Number(prix),
        caution_da: Number(caution),
        description,
        photo_principale: finalPhoto,
        photos: photosList,
        statut
      };

      if (supabase) {
        mirrorToCloud(() => supabase.from('robes').update(mapDressToDb(updatedDressObj)).eq('id', editingDress.id), LOCAL_SYNC_FAIL);
      }

      const updated = dresses.map(d => d.id === editingDress.id ? updatedDressObj : d);
      onSaveDresses(updated);

      addHistoryEntry(
        language === 'fr' ? 'Modification de robe' : 'تعديل فستان',
        `La robe "${nom}" a été modifiée.`
      );
    } else {
      // Record the dress locally first. Writing only to Supabase and then
      // refetching meant the new dress vanished from the list whenever the
      // insert or the refetch did not go through.
      const newDress: Dress = {
        id: crypto.randomUUID(),
        nom,
        categorie,
        couleur,
        taille,
        prix_location_da: Number(prix),
        caution_da: Number(caution),
        description,
        photo_principale: finalPhoto,
        photos: photosList,
        statut: 'disponible',
        date_creation: todayIso()
      };
      onSaveDresses([newDress, ...dresses]);

      addHistoryEntry(
        language === 'fr' ? 'Ajout de robe' : 'إضافة فستان',
        `Nouvelle robe "${nom}" ajoutée avec succès.`
      );

      // Then mirror it to the cloud, best effort.
      if (!supabase) {
        notifySuccess(language === 'fr'
          ? 'Robe ajoutée sur cet appareil (cloud non configuré).'
          : 'تمت إضافة الفستان على هذا الجهاز (السحابة غير مهيأة).');
      } else {
        const rowToInsert = {
          nom,
          categorie,
          taille,
          couleur,
          prix_location: Number(prix),
          caution: Number(caution),
          statut: 'disponible',
          photo_url: finalPhoto
        };

        const { error } = await supabase.from('robes').insert([rowToInsert]).select();

        if (error) {
          console.error('Supabase insert robe error:', error);
          notifyError(language === 'fr'
            ? "Robe ajoutée sur cet appareil, mais la synchronisation avec le cloud a échoué."
            : 'تمت إضافة الفستان محلياً، لكن فشلت المزامنة مع السحابة.');
        } else {
          notifySuccess(language === 'fr' ? 'Robe ajoutée et synchronisée.' : 'تمت إضافة الفستان ومزامنته.');
          // Only pull the cloud copy back once it actually holds this dress.
        }
      }
    }

    setIsFormOpen(false);
  };

  // Filtering Logic
  const filteredDresses = dresses.filter(d => {
    const matchesSearch = d.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.couleur.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || d.categorie === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || d.statut === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Sorting Logic
  const sortedDresses = [...filteredDresses].sort((a, b) => {
    if (sortBy === 'price-asc') return a.prix_location_da - b.prix_location_da;
    if (sortBy === 'price-desc') return b.prix_location_da - a.prix_location_da;
    if (sortBy === 'name') return a.nom.localeCompare(b.nom);
    return new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime(); // recent
  });

  // Format DZD
  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  };

  // "Occupée" on the badge doesn't say when it frees up — worth a line on
  // the card itself for the one case that matters most: it can go straight
  // back out this afternoon.
  const todayStr = todayIso();
  const returningToday = (dressId: string) =>
    reservations.some(r =>
      (r.statut === 'en_cours' || r.statut === 'en_retard') &&
      r.date_retour === todayStr &&
      r.items.some(i => i.type_article === 'robe' && i.article_id === dressId)
    );

  // Status Badge Mapper
  const renderStatusBadge = (status: DressStatus) => {
    const badgeBase = "px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 w-fit";
    if (status === 'disponible') {
      return (
        <span className={`${badgeBase} bg-emerald-50 border-emerald-100 text-emerald-700`}>
          <CheckCircle size={12} />
          {t.statut_disponible}
        </span>
      );
    }
    if (status === 'reservee') {
      return (
        <span className={`${badgeBase} bg-amber-50 border-amber-100 text-amber-700`}>
          <Sparkles size={12} />
          {t.statut_reservee}
        </span>
      );
    }
    if (status === 'en_location') {
      return (
        <span className={`${badgeBase} bg-violet-50 border-violet-100 text-violet-700`}>
          <ChevronRight size={12} />
          {t.statut_en_location}
        </span>
      );
    }
    return (
      <span className={`${badgeBase} bg-gray-100 border-gray-200 text-gray-700`}>
        <Wrench size={12} />
        {t.statut_en_entretien}
      </span>
    );
  };

  return (
    <div className={`space-y-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header Panel */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
        isRtl ? 'sm:flex-row-reverse' : ''
      }`}>
        <div>
          <h2 className="font-display text-[2rem] leading-tight text-neutral-900">
            {language === 'fr' ? 'Gestion des Robes' : 'إدارة الفساتين'}
          </h2>
          <p className="mt-1 text-[15px] text-neutral-500">
            {language === 'fr' 
              ? `Affichez, filtrez et modifiez l'inventaire des robes du magasin (${dresses.length} modèles).`
              : `اعرض، صنف وعدل قائمة فساتين المحل الحالية (${dresses.length} موديل).`}
          </p>
        </div>
        <div className={`flex flex-wrap items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>

          <button
            id="add-dress-top-btn"
            onClick={openAddForm}
            className="flex items-center gap-2 bg-orange-600 text-white font-bold px-5 py-3 rounded-2xl cursor-pointer transition-all text-sm"
          >
            <Plus size={16} />
            <span>{language === 'fr' ? 'Ajouter une robe' : 'إضافة فستان جديد'}</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-4">
        <div className={`flex flex-col md:flex-row gap-4 ${isRtl ? 'md:flex-row-reverse' : ''}`}>
          {/* Search bar */}
          <div className="relative flex-1">
            <span className={`absolute inset-y-0 flex items-center text-gray-400 pointer-events-none ${isRtl ? 'left-4' : 'left-4'}`}>
              <Search size={18} />
            </span>
            <input
              id="dress-search-input"
              type="text"
              placeholder={t.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full py-3 pr-4 pl-11 bg-slate-50 border border-neutral-200 rounded-2xl text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition-all ${
                isRtl ? 'text-right' : 'text-left'
              }`}
            />
          </div>

          {/* Sort Selector */}
          <div className="w-full md:w-56">
            <select
              id="dress-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full py-3 px-4 bg-slate-50 border border-neutral-200 rounded-2xl text-sm text-gray-700 font-medium focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              <option value="recent">{language === 'fr' ? 'Plus récents' : 'أضيف مؤخراً'}</option>
              <option value="price-asc">{language === 'fr' ? 'Prix : Ordre croissant' : 'السعر: من الأقل للأعلى'}</option>
              <option value="price-desc">{language === 'fr' ? 'Prix : Ordre décroissant' : 'السعر: من الأعلى للأقل'}</option>
              <option value="name">{language === 'fr' ? 'Nom alphabétique' : 'الاسم أبجدياً'}</option>
            </select>
          </div>
        </div>

        {/* Categories & Status Tabs */}
        <div className={`flex flex-wrap items-center gap-3 border-t border-gray-50 pt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold uppercase tracking-wider font-mono">
            <Filter size={12} />
            <span>{language === 'fr' ? 'Catégorie' : 'الفئة'} :</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              id="cat-filter-all"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedCategory === 'all'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
              }`}
            >
              {t.all}
            </button>
            {categoriesList.map(cat => (
              <button
                key={cat.id}
                id={`cat-filter-${cat.id}`}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`flex flex-wrap items-center gap-3 border-t border-gray-50 pt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold uppercase tracking-wider font-mono">
            <CheckCircle size={12} />
            <span>{t.status} :</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              id="stat-filter-all"
              onClick={() => setSelectedStatus('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedStatus === 'all'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
              }`}
            >
              {t.all}
            </button>
            <button
              id="stat-filter-disp"
              onClick={() => setSelectedStatus('disponible')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedStatus === 'disponible'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-50 text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {t.statut_disponible}
            </button>
            <button
              id="stat-filter-res"
              onClick={() => setSelectedStatus('reservee')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedStatus === 'reservee'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-50 text-amber-500 hover:bg-amber-50'
              }`}
            >
              {t.statut_reservee}
            </button>
            <button
              id="stat-filter-loc"
              onClick={() => setSelectedStatus('en_location')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedStatus === 'en_location'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-50 text-violet-600 hover:bg-violet-50'
              }`}
            >
              {t.statut_en_location}
            </button>
            <button
              id="stat-filter-ent"
              onClick={() => setSelectedStatus('en_entretien')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedStatus === 'en_entretien'
                  ? 'bg-gray-600 text-white'
                  : 'bg-slate-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.statut_en_entretien}
            </button>
          </div>
        </div>
      </div>

      {/* Dresses Grid */}
      {sortedDresses.length === 0 ? (
        <div className="bg-white py-16 px-4 rounded-2xl border border-neutral-200 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Search size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">{language === 'fr' ? 'Aucune robe trouvée' : 'لا توجد فساتين مطابقة'}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {language === 'fr' ? 'Modifiez vos critères de recherche ou ajoutez un nouveau modèle.' : 'يرجى تغيير معايير البحث أو إضافة موديل جديد.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedDresses.map(dress => (
            <div
              key={dress.id}
              className="bg-white rounded-2xl overflow-hidden border border-neutral-200 transition-all duration-350 group flex flex-col justify-between"
            >
              {/* Image Header with status badges */}
              <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden shrink-0">
                <img
                  src={dress.photo_principale}
                  alt={dress.nom}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} z-10`}>
                  {renderStatusBadge(dress.statut)}
                </div>
                <div className={`absolute bottom-4 ${isRtl ? 'right-4' : 'left-4'} bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-xl text-white font-bold text-xs uppercase tracking-wide`}>
                  {categoriesList.find(c => c.id === dress.categorie)?.label || dress.categorie}
                </div>
              </div>

              {/* Body details */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-violet-600 transition-colors leading-tight">
                    {dress.nom}
                  </h3>
                  
                  {/* Size, Color Row */}
                  <div className={`flex gap-3.5 mt-3 text-xs text-gray-500 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className="bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                      <strong>{t.size} :</strong> {dress.taille}
                    </span>
                    <span className="bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                      <strong>{t.color} :</strong> {dress.couleur}
                    </span>
                  </div>

                  {returningToday(dress.id) && (
                    <p className={`mt-2 text-[11px] font-semibold text-blue-600 flex items-center gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <RotateCcw size={11} />
                      {language === 'fr' ? "Revient aujourd'hui" : 'تعود اليوم'}
                    </p>
                  )}

                  <p className="text-xs text-gray-500 leading-relaxed mt-4 line-clamp-2">
                    {dress.description || (language === 'fr' ? 'Aucune description fournie.' : 'لا يوجد وصف.')}
                  </p>
                </div>

                {/* Pricing & Quick action row */}
                <div className="mt-6 pt-5 border-t border-gray-50">
                  <div className={`flex justify-between items-end mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className={isRtl ? 'text-right' : 'text-left'}>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.rental_price}</span>
                      <p className="text-lg font-extrabold text-violet-600 leading-none">{formatDa(dress.prix_location_da)}</p>
                    </div>
                    <div className={isRtl ? 'text-left' : 'text-right'}>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.caution}</span>
                      <p className="text-xs font-semibold text-gray-600 leading-none">{formatDa(dress.caution_da)}</p>
                    </div>
                  </div>

                  {/* Operational Buttons */}
                  <div className={`flex gap-2 pt-1 border-t border-dashed border-neutral-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <button
                      id={`edit-dress-btn-${dress.id}`}
                      onClick={(e) => openEditForm(dress, e)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-50 hover:bg-violet-50 text-gray-600 hover:text-violet-600 text-xs font-bold border border-slate-100 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Edit3 size={12} />
                      <span>{t.edit}</span>
                    </button>

                    <button
                      id={`maintenance-dress-btn-${dress.id}`}
                      onClick={(e) => toggleMaintenance(dress.id, dress.statut, e)}
                      disabled={dress.statut === 'en_location'}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                        dress.statut === 'en_entretien'
                          ? 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100'
                          : 'bg-slate-50 border-slate-100 text-gray-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      <Wrench size={12} />
                    </button>

                    <button
                      id={`delete-dress-btn-${dress.id}`}
                      onClick={(e) => handleDelete(dress.id, e)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-neutral-200 hover:border-red-200/80 rounded-xl cursor-pointer flex items-center justify-center transition-all duration-200"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-over Form Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay background */}
          <div 
            onClick={() => setIsFormOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          />

          {/* Sliding panel */}
          <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col z-10 animate-slide-in">
            {/* Header */}
            <div className={`p-6 border-b border-neutral-200 flex justify-between items-center bg-slate-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingDress 
                    ? (language === 'fr' ? 'Modifier la robe' : 'تعديل الفستان') 
                    : (language === 'fr' ? 'Ajouter une robe' : 'إضافة فستان جديد')}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {language === 'fr' ? 'Remplissez le formulaire ci-dessous.' : 'يرجى ملء الاستمارة أدناه.'}
                </p>
              </div>
              <button
                id="close-form-btn"
                onClick={() => setIsFormOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Nom */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{t.dress_name} *</label>
                <input
                  id="form-dress-name"
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex: Caftan d’Or Royal"
                  className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>

              {/* Grid: Category & Taille */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">{t.category}</label>
                  <select
                    id="form-dress-cat"
                    value={categorie}
                    onChange={(e) => setCategorie(e.target.value as DressCategory)}
                    className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
                  >
                    {categoriesList.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">{t.size} *</label>
                  <input
                    id="form-dress-size"
                    type="text"
                    required
                    value={taille}
                    onChange={(e) => setTaille(e.target.value)}
                    placeholder="Ex: 38 (M)"
                    className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                      isRtl ? 'text-right' : 'text-left'
                    }`}
                  />
                </div>
              </div>

              {/* Grid: Couleur & Statut */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">{t.color} *</label>
                  <input
                    id="form-dress-color"
                    type="text"
                    required
                    value={couleur}
                    onChange={(e) => setCouleur(e.target.value)}
                    placeholder="Ex: Rose Poudré"
                    className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                      isRtl ? 'text-right' : 'text-left'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">{t.status}</label>
                  <select
                    id="form-dress-status"
                    value={statut}
                    onChange={(e) => setStatut(e.target.value as DressStatus)}
                    className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
                  >
                    <option value="disponible">{t.statut_disponible}</option>
                    <option value="en_entretien">{t.statut_en_entretien}</option>
                    {editingDress && <option value="reservee">{t.statut_reservee}</option>}
                    {editingDress && <option value="en_location">{t.statut_en_location}</option>}
                  </select>
                </div>
              </div>

              {/* Grid: Price & Caution */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">{t.rental_price} (DA) *</label>
                  <input
                    id="form-dress-price"
                    type="number"
                    min="0"
                    required
                    value={prix}
                    onChange={(e) => setPrix(Number(e.target.value))}
                    className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">{t.caution} (DA) *</label>
                  <input
                    id="form-dress-caution"
                    type="number"
                    min="0"
                    required
                    value={caution}
                    onChange={(e) => setCaution(Number(e.target.value))}
                    className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{t.description}</label>
                <textarea
                  id="form-dress-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Matériaux, broderies, accessoires inclus..."
                  className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>

              {/* Image upload widget */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 block">{language === 'fr' ? 'Photo de la robe' : 'صورة الفستان'}</label>
                
                {/* Visual Drag and drop */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    dragActive 
                      ? 'border-violet-500 bg-violet-50/50' 
                      : 'border-gray-200 bg-slate-50/50 hover:bg-slate-50 hover:border-violet-300'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  {isUploadingImage ? (
                    <div className="space-y-2 text-violet-600 flex flex-col items-center py-4">
                      <Loader2 size={28} className="animate-spin text-violet-600" />
                      <p className="text-xs font-semibold">
                        {language === 'fr' 
                          ? `Envoi des images séquentiellement (${uploadProgress?.current || 1}/${uploadProgress?.total || 1})...` 
                          : `جاري رفع الصور بالتتابع (${uploadProgress?.current || 1}/${uploadProgress?.total || 1})...`}
                      </p>
                    </div>
                  ) : photoMain ? (
                    <div className="space-y-3">
                      <div className="relative w-32 h-32 mx-auto rounded-xl overflow-hidden border border-neutral-200">
                        <img src={photoMain} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          id="clear-photo-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoMain('');
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium">
                        {language === 'fr' ? 'Cliquez ou glissez pour ajouter d’autres photos' : 'انقر أو اسحب لإضافة صور أخرى'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-gray-500 flex flex-col items-center">
                      <Upload size={24} className="text-gray-400" />
                      <p className="text-xs font-semibold">
                        {language === 'fr' 
                          ? 'Glissez-déposez des images ou cliquez pour parcourir' 
                          : 'اسحب صوراً هنا أو اضغط للتصفح'}
                      </p>
                      <p className="text-[10px] text-gray-400">PNG, JPG, WEBP (sélection multiple autorisée)</p>
                    </div>
                  )}
                </div>

                {/* Secondary photos preview */}
                {photosList && photosList.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-gray-700 block">
                      {language === 'fr' ? `Photos secondaires (${photosList.length})` : `صور إضافية (${photosList.length})`}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {photosList.map((url, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-200">
                          <img src={url} alt={`Secondary ${idx}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPhotosList(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-black text-white rounded-full"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct Image URL fallback */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">
                    {language === 'fr' ? 'OU Saisir l’URL directe de la photo' : 'أو أدخل رابطاً مباشراً للصورة'}
                  </span>
                  <input
                    id="form-dress-photo-url"
                    type="text"
                    value={photoMain.startsWith('data:') ? '' : photoMain}
                    onChange={(e) => setPhotoMain(e.target.value)}
                    placeholder="https://example.com/dress.jpg"
                    className="w-full p-2.5 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Submit panel */}
              <div className="pt-6 border-t border-gray-50 flex gap-3">
                <button
                  type="button"
                  id="cancel-form-btn"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-50 hover:bg-slate-100 text-gray-700 text-sm font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  id="submit-form-btn"
                  className="flex-1 py-3 px-4 bg-orange-600 text-white text-sm font-bold rounded-xl cursor-pointer hover:shadow-violet-500/10 transition-all"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
