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
  Loader2
} from 'lucide-react';
import { Dress, DressCategory, DressStatus, Language } from '../types';
import { translations } from '../translations';
import { addHistoryEntry, getSupabaseClient, mapDressToDb, uploadImageToSupabase, ensurePublicUrl } from '../lib/storage';
import { generateAdditionalDresses } from '../data/sampleData';

interface RobesProps {
  dresses: Dress[];
  onSaveDresses: (dresses: Dress[]) => void;
  language: Language;
  initialOpenForm?: boolean;
  onFormOpenHandled?: () => void;
  onRefreshData?: () => void;
}

export default function Robes({ 
  dresses, 
  onSaveDresses, 
  language,
  initialOpenForm,
  onFormOpenHandled,
  onRefreshData
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
          alert(`Erreur lors de l'envoi de l'image (${file.name}) : ` + (err.message || err));

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

  // Bulk add 70 dresses
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const handleAdd70Dresses = async () => {
    setIsAddingBulk(true);
    try {
      const extraDresses = generateAdditionalDresses(70, Date.now());
      const updatedList = [...dresses, ...extraDresses];

      // Save locally & trigger sync
      onSaveDresses(updatedList);

      // Save directly to Supabase if connected
      const supabase = getSupabaseClient();
      if (supabase) {
        const rowsToInsert = extraDresses.map(mapDressToDb);
        const { error } = await supabase.from('robes').upsert(rowsToInsert as any);
        if (error) {
          console.warn('Supabase bulk insert warning:', error);
        }
      }

      addHistoryEntry(
        language === 'fr' ? 'Ajout massif de robes' : 'إضافة مجموعة فساتين',
        `70 nouvelles robes ont été ajoutées au catalogue (Total: ${updatedList.length}).`
      );

      alert(language === 'fr' 
        ? `70 nouvelles robes ont été ajoutées avec succès ! Total : ${updatedList.length} robes.` 
        : `تمت إضافة 70 فستان جديد بنجاح! المجموع: ${updatedList.length} فستان.`);

      onRefreshData?.();
    } catch (err) {
      console.error('Error adding bulk dresses:', err);
    } finally {
      setIsAddingBulk(false);
    }
  };

  // Set exactly 70 dresses
  const [isSetting70, setIsSetting70] = useState(false);
  const handleSetExactly70Dresses = async () => {
    setIsSetting70(true);
    try {
      let updatedList: Dress[] = [];
      const supabase = getSupabaseClient();

      if (dresses.length > 70) {
        updatedList = dresses.slice(0, 70);
        const dressesToRemove = dresses.slice(70);

        if (supabase) {
          const idsToDelete = dressesToRemove.map(d => d.id);
          const { error } = await supabase.from('robes').delete().in('id', idsToDelete);
          if (error) {
            console.warn('Supabase delete warning:', error);
          }
        }

        addHistoryEntry(
          language === 'fr' ? 'Ajustement inventaire' : 'تعديل القائمة',
          `${dressesToRemove.length} robes ont été retirées du catalogue (Total restants: 70).`
        );

        alert(language === 'fr' 
          ? `Ajustement effectué : Le catalogue contient maintenant exactement 70 robes ! (${dressesToRemove.length} robes en trop supprimées)` 
          : `تم تعديل القائمة: يوجد الآن 70 فستان بالضبط!`);
      } else if (dresses.length < 70) {
        const needed = 70 - dresses.length;
        const extraDresses = generateAdditionalDresses(needed, Date.now());
        updatedList = [...dresses, ...extraDresses];

        if (supabase) {
          const rowsToInsert = extraDresses.map(mapDressToDb);
          const { error } = await supabase.from('robes').upsert(rowsToInsert as any);
          if (error) {
            console.warn('Supabase insert warning:', error);
          }
        }

        addHistoryEntry(
          language === 'fr' ? 'Ajustement inventaire' : 'تعديل القائمة',
          `${needed} robes ont été ajoutées au catalogue (Total: 70).`
        );

        alert(language === 'fr' 
          ? `Ajustement effectué : Le catalogue contient maintenant exactement 70 robes !` 
          : `تم تعديل القائمة: يوجد الآن 70 فستان بالضبط!`);
      } else {
        alert(language === 'fr' ? 'Il y a déjà exactement 70 robes.' : 'يوجد بالفعل 70 فستان بالضبط.');
        return;
      }

      onSaveDresses(updatedList);
      onRefreshData?.();
    } catch (err) {
      console.error('Error setting 70 dresses:', err);
    } finally {
      setIsSetting70(false);
    }
  };

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

    if (window.confirm(msg)) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from('robes').delete().eq('id', dressId);
        if (error) {
          alert("Erreur Supabase : " + error.message);
          console.error('Supabase delete error:', error);
        }
      }

      const updated = dresses.filter(d => d.id !== dressId);
      onSaveDresses(updated);
      onRefreshData?.();
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
      const { error } = await supabase.from('robes').update({ statut: targetStatus }).eq('id', dressId);
      if (error) {
        alert("Erreur Supabase : " + error.message);
        console.error('Supabase update status error:', error);
      }
    }

    const updated = dresses.map(d => {
      if (d.id === dressId) {
        return { ...d, statut: targetStatus };
      }
      return d;
    });
    onSaveDresses(updated);
    onRefreshData?.();

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
      alert(language === 'fr' ? 'Veuillez remplir les champs obligatoires' : 'يرجى ملء الحقول الإجبارية');
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
        const { error } = await supabase.from('robes').update(mapDressToDb(updatedDressObj)).eq('id', editingDress.id);
        if (error) {
          alert("Erreur Supabase : " + error.message);
          console.error('Supabase update robe error:', error);
        }
      }

      const updated = dresses.map(d => d.id === editingDress.id ? updatedDressObj : d);
      onSaveDresses(updated);
      onRefreshData?.();

      addHistoryEntry(
        language === 'fr' ? 'Modification de robe' : 'تعديل فستان',
        `La robe "${nom}" a été modifiée.`
      );
    } else {
      // Create new dress directly in Supabase
      if (!supabase) {
        alert("Erreur Supabase : Client Supabase non initialisé");
        return;
      }

      // Payload matching Supabase robes table columns: nom, categorie, taille, couleur, prix_location, caution, statut, photo_url (without id)
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
        alert("Erreur Supabase : " + error.message);
        console.error('Supabase insert robe error:', error);
        return; // Stop execution on error
      }

      alert("Robe ajoutée avec succès !");

      await onRefreshData?.();

      addHistoryEntry(
        language === 'fr' ? 'Ajout de robe' : 'إضافة فستان',
        `Nouvelle robe "${nom}" ajoutée avec succès.`
      );
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
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm ${
        isRtl ? 'sm:flex-row-reverse' : ''
      }`}>
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            👗 {language === 'fr' ? 'Gestion des Robes' : 'إدارة الفساتين'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'fr' 
              ? `Affichez, filtrez et modifiez l'inventaire des robes du magasin (${dresses.length} modèles).`
              : `اعرض، صنف وعدل قائمة فساتين المحل الحالية (${dresses.length} موديل).`}
          </p>
        </div>
        <div className={`flex flex-wrap items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          {dresses.length !== 70 && (
            <button
              id="set-exact-70-robes-btn"
              onClick={handleSetExactly70Dresses}
              disabled={isSetting70 || isAddingBulk}
              className={`flex items-center gap-2 font-bold px-4 py-3 rounded-2xl cursor-pointer hover:shadow-md active:scale-95 transition-all text-xs border ${
                dresses.length > 70 
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200' 
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
              }`}
              title={language === 'fr' ? 'Ajuster directement l\'inventaire à exactement 70 robes' : 'ضبط القائمة إلى 70 فستان بالضبط'}
            >
              <CheckCircle size={15} className={dresses.length > 70 ? 'text-rose-600' : 'text-emerald-600'} />
              <span>
                {isSetting70 
                  ? '...' 
                  : (language === 'fr' 
                      ? (dresses.length > 70 ? `Fixer à 70 robes (Supprimer ${dresses.length - 70})` : `Ajuster à 70 robes (+${70 - dresses.length})`)
                      : `تعديل إلى 70 فستان`)}
              </span>
            </button>
          )}

          <button
            id="add-bulk-70-robes-btn"
            onClick={handleAdd70Dresses}
            disabled={isAddingBulk || isSetting70}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-3 rounded-2xl cursor-pointer hover:shadow-md active:scale-95 transition-all text-xs border border-slate-700"
            title={language === 'fr' ? 'Générer et rajouter 70 robes instantanément sur Supabase' : 'إضافة 70 فستان جديد فوراً'}
          >
            <Sparkles size={15} className="text-amber-400" />
            <span>{isAddingBulk ? '...' : (language === 'fr' ? '+ 70 Robes' : '+ 70 فستان')}</span>
          </button>

          <button
            id="add-dress-top-btn"
            onClick={openAddForm}
            className="flex items-center gap-2 bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white font-bold px-5 py-3 rounded-2xl cursor-pointer hover:shadow-lg hover:shadow-violet-500/20 active:scale-95 transition-all text-sm"
          >
            <Plus size={16} />
            <span>{language === 'fr' ? 'Ajouter une robe' : 'إضافة فستان جديد'}</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-5 rounded-[20px] border border-gray-200/80 shadow-sm space-y-4">
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
              className={`w-full py-3 pr-4 pl-11 bg-slate-50 border border-gray-200/80 rounded-2xl text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition-all ${
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
              className="w-full py-3 px-4 bg-slate-50 border border-gray-200/80 rounded-2xl text-sm text-gray-700 font-medium focus:outline-none focus:border-violet-500 cursor-pointer"
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
                  ? 'bg-violet-600 text-white shadow-sm'
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
                  ? 'bg-emerald-600 text-white shadow-sm'
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
                  ? 'bg-amber-500 text-white shadow-sm'
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
                  ? 'bg-violet-600 text-white shadow-sm'
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
                  ? 'bg-gray-600 text-white shadow-sm'
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
        <div className="bg-white py-16 px-4 rounded-[20px] border border-gray-200/80 shadow-sm text-center">
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
              className="bg-white rounded-[20px] overflow-hidden border border-gray-200/80 shadow-sm hover:shadow-md transition-all duration-350 group flex flex-col justify-between"
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
                  <div className={`flex gap-2 pt-1 border-t border-dashed border-gray-200/80 ${isRtl ? 'flex-row-reverse' : ''}`}>
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
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200/80 hover:border-red-200/80 rounded-xl cursor-pointer flex items-center justify-center transition-all duration-200"
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
            <div className={`p-6 border-b border-gray-200/80 flex justify-between items-center bg-slate-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
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
                  className={`w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 ${
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
                    className="w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
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
                    className={`w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
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
                    className={`w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
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
                    className="w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
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
                    className="w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500"
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
                    className="w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500"
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
                  className={`w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
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
                      <div className="relative w-32 h-32 mx-auto rounded-xl overflow-hidden border border-gray-200/80 shadow-sm">
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
                        <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200/80 shadow-sm">
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
                    className="w-full p-2.5 border border-gray-200/80 rounded-xl text-xs focus:outline-none focus:border-violet-500"
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
                  className="flex-1 py-3 px-4 bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white text-sm font-bold rounded-xl cursor-pointer hover:shadow-lg hover:shadow-violet-500/10 transition-all"
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
