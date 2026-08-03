import React, { useState, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Edit3, 
  Sparkles, 
  Upload, 
  X, 
  CheckCircle, 
  Wrench,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Bijou, Language } from '../types';
import { translations } from '../translations';
import { addHistoryEntry, getSupabaseClient, mapBijouToDb, uploadImageToSupabase, ensurePublicUrl } from '../lib/storage';
import { generate200Bijoux } from '../data/sampleData';

interface BijouxProps {
  bijoux: Bijou[];
  onSaveBijoux: (bijoux: Bijou[]) => void;
  language: Language;
  initialOpenForm?: boolean;
  onFormOpenHandled?: () => void;
  onRefreshData?: () => void;
}

export default function Bijoux({ 
  bijoux, 
  onSaveBijoux, 
  language,
  initialOpenForm,
  onFormOpenHandled,
  onRefreshData
}: BijouxProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(initialOpenForm || false);

  React.useEffect(() => {
    if (initialOpenForm) {
      setIsFormOpen(true);
      onFormOpenHandled?.();
    }
  }, [initialOpenForm, onFormOpenHandled]);
  const [editingBijou, setEditingBijou] = useState<Bijou | null>(null);

  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('');
  const [prix, setPrix] = useState<number>(3000);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');
  const [photosList, setPhotosList] = useState<string[]>([]);
  const [statut, setStatut] = useState<'disponible' | 'reserve' | 'en_location' | 'en_entretien'>('disponible');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // File drop handler
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
      let currentPhoto = photo;
      const newSecondaryPhotos: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });

        try {
          // Sequential upload: one photo by one photo into 'bijoux' bucket
          const publicUrl = await uploadImageToSupabase(file, 'bijoux');
          if (!currentPhoto) {
            currentPhoto = publicUrl;
            setPhoto(publicUrl);
          } else {
            newSecondaryPhotos.push(publicUrl);
          }
        } catch (err: any) {
          console.error(`Erreur upload bijou ${i + 1}/${files.length} sur Supabase:`, err);
          alert(`Erreur lors de l'envoi de l'image (${file.name}) : ` + (err.message || err));

          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => resolve((uploadEvent.target?.result as string) || '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
          });

          if (base64 && !base64.startsWith('blob:')) {
            if (!currentPhoto) {
              currentPhoto = base64;
              setPhoto(base64);
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

  const [isSetting200, setIsSetting200] = useState(false);
  const handleSet200Bijoux = async () => {
    setIsSetting200(true);
    try {
      const list200 = generate200Bijoux();
      onSaveBijoux(list200);

      const supabase = getSupabaseClient();
      if (supabase) {
        const rowsToInsert = list200.map(mapBijouToDb);
        const { error } = await supabase.from('bijoux').upsert(rowsToInsert as any);
        if (error) {
          console.warn('Supabase bulk bijoux upsert warning:', error);
        }
      }

      addHistoryEntry(
        language === 'fr' ? 'Génération 200 Bijoux' : 'إنشاء 200 إكسسوار',
        `La collection d'accessoires a été mise à jour à 200 pièces.`
      );

      alert(language === 'fr' 
        ? `La collection a été mise à jour avec succès à 200 bijoux !` 
        : `تم تحديث المجموعة بنجاح إلى 200 قطعة إكسسوار!`);

      onRefreshData?.();
    } catch (err) {
      console.error('Error generating 200 bijoux:', err);
    } finally {
      setIsSetting200(false);
    }
  };

  // Open forms
  const openAddForm = () => {
    setEditingBijou(null);
    setNom('');
    setCategorie('');
    setPrix(3000);
    setDescription('');
    setPhoto('');
    setPhotosList([]);
    setStatut('disponible');
    setIsFormOpen(true);
  };

  const openEditForm = (bijou: Bijou, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBijou(bijou);
    setNom(bijou.nom);
    setCategorie(bijou.categorie);
    setPrix(bijou.prix_location_da);
    setDescription(bijou.description);
    setPhoto(bijou.photo);
    setPhotosList(bijou.photos || (bijou.photo ? [bijou.photo] : []));
    setStatut(bijou.statut);
    setIsFormOpen(true);
  };

  // Delete
  const handleDelete = async (bijouId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const bijou = bijoux.find(b => b.id === bijouId);
    if (!bijou) return;

    const msg = language === 'fr' 
      ? `Êtes-vous sûr de vouloir supprimer l'accessoire "${bijou.nom}" ?`
      : `هل أنت متأكد من حذف الإكسسوار "${bijou.nom}"؟`;

    if (window.confirm(msg)) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from('bijoux').delete().eq('id', bijouId);
        if (error) {
          alert("Erreur Supabase : " + error.message);
          console.error('Supabase delete bijou error:', error);
        }
      }

      const updated = bijoux.filter(b => b.id !== bijouId);
      onSaveBijoux(updated);
      onRefreshData?.();

      addHistoryEntry(
        language === 'fr' ? 'Suppression d’accessoire' : 'حذف إكسسوار',
        `L'accessoire "${bijou.nom}" (ID: ${bijou.id}) a été retiré.`
      );
    }
  };

  const toggleMaintenance = async (bijouId: string, currentStatut: typeof statut, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetStatus = currentStatut === 'en_entretien' ? 'disponible' : 'en_entretien';

    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('bijoux').update({ statut: targetStatus }).eq('id', bijouId);
      if (error) {
        alert("Erreur Supabase : " + error.message);
        console.error('Supabase update bijou status error:', error);
      }
    }

    const updated: Bijou[] = bijoux.map(b => {
      if (b.id === bijouId) {
        return { ...b, statut: targetStatus as any };
      }
      return b;
    });
    onSaveBijoux(updated);
    onRefreshData?.();

    const bijou = bijoux.find(b => b.id === bijouId);
    if (bijou) {
      addHistoryEntry(
        language === 'fr' ? 'Entretien bijou' : 'صيانة إكسسوار',
        `L'accessoire "${bijou.nom}" est passé au statut "${targetStatus}".`
      );
    }
  };

  // Submit form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !categorie) {
      alert(language === 'fr' ? 'Veuillez remplir les champs obligatoires' : 'يرجى ملء الحقول الإجبارية');
      return;
    }

    const defaultPhoto = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=400';
    let finalPhoto = photo || defaultPhoto;

    if (finalPhoto.startsWith('blob:')) {
      try {
        finalPhoto = await ensurePublicUrl(finalPhoto, 'bijoux');
      } catch {
        finalPhoto = defaultPhoto;
      }
    }
    if (!finalPhoto || finalPhoto.startsWith('blob:')) {
      finalPhoto = defaultPhoto;
    }

    const cleanPhotosList = photosList.filter(p => !p.startsWith('blob:'));
    if (cleanPhotosList.length === 0 && finalPhoto) {
      cleanPhotosList.push(finalPhoto);
    }

    const supabase = getSupabaseClient();

    if (editingBijou) {
      const updatedBijouObj: Bijou = {
        ...editingBijou,
        nom,
        categorie,
        prix_location_da: Number(prix),
        description,
        photo: finalPhoto,
        photos: cleanPhotosList,
        statut: statut as any
      };

      if (supabase) {
        const rowToUpdate = mapBijouToDb(updatedBijouObj);
        let { error } = await supabase.from('bijoux').update(rowToUpdate).eq('id', editingBijou.id);
        if (error && (error.message?.includes('photos') || error.code === 'PGRST204')) {
          delete rowToUpdate.photos;
          const retry = await supabase.from('bijoux').update(rowToUpdate).eq('id', editingBijou.id);
          error = retry.error;
        }
        if (error) {
          alert("Erreur Supabase : " + error.message);
          console.error('Supabase update bijou error:', error);
        }
      }

      const updated: Bijou[] = bijoux.map(b => b.id === editingBijou.id ? updatedBijouObj : b);
      onSaveBijoux(updated);
      onRefreshData?.();

      addHistoryEntry(
        language === 'fr' ? 'Modification d’accessoire' : 'تعديل إكسسوار',
        `L'accessoire "${nom}" a été mis à jour.`
      );
    } else {
      if (!supabase) {
        alert("Erreur Supabase : Client Supabase non initialisé");
        return;
      }

      const rowToInsert: any = {
        nom,
        type: categorie,
        prix_location: Number(prix),
        caution: 0,
        statut: 'disponible',
        photo_url: finalPhoto,
        photos: cleanPhotosList
      };

      let { error } = await supabase.from('bijoux').insert([rowToInsert]).select();
      if (error && (error.message?.includes('photos') || error.code === 'PGRST204')) {
        delete rowToInsert.photos;
        const retry = await supabase.from('bijoux').insert([rowToInsert]).select();
        error = retry.error;
      }

      if (error) {
        alert("Erreur Supabase : " + error.message);
        console.error('Supabase insert bijou error:', error);
        return;
      }

      alert("Accessoire ajouté avec succès !");

      await onRefreshData?.();

      addHistoryEntry(
        language === 'fr' ? 'Ajout d’accessoire' : 'إضافة إكسسوار',
        `Nouvel accessoire "${nom}" ajouté à la collection.`
      );
    }

    setIsFormOpen(false);
  };

  // Filter
  const filteredBijoux = bijoux.filter(b => {
    const matchesSearch = b.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.categorie.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || b.statut === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  };

  const renderStatusBadge = (status: typeof statut) => {
    const badgeBase = "px-2 py-0.5 text-[10px] font-bold rounded-md border flex items-center gap-1 w-fit";
    if (status === 'disponible') {
      return (
        <span className={`${badgeBase} bg-emerald-50 border-emerald-100 text-emerald-700`}>
          <CheckCircle size={10} />
          {t.statut_disponible}
        </span>
      );
    }
    if (status === 'reserve') {
      return (
        <span className={`${badgeBase} bg-amber-50 border-amber-100 text-amber-700`}>
          <Sparkles size={10} />
          {t.statut_reservee}
        </span>
      );
    }
    if (status === 'en_location') {
      return (
        <span className={`${badgeBase} bg-violet-50 border-violet-100 text-violet-700`}>
          <ChevronRight size={10} />
          {t.statut_en_location}
        </span>
      );
    }
    return (
      <span className={`${badgeBase} bg-gray-100 border-gray-200 text-gray-700`}>
        <Wrench size={10} />
        {t.statut_en_entretien}
      </span>
    );
  };

  return (
    <div className={`space-y-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm ${
        isRtl ? 'sm:flex-row-reverse' : ''
      }`}>
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            💍 {language === 'fr' ? 'Gestion des Bijoux & Accessoires' : 'إدارة الحلي والإكسسوارات'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'fr' 
              ? `Gérez la collection d'accessoires traditionnels associés aux parures (${bijoux.length} pièces).`
              : `أديري الحلي التقليدية التي تكمل الفساتين وتزيد من هيبة العروس (${bijoux.length} قطعة).`}
          </p>
        </div>
        <div className={`flex flex-wrap items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <button
            id="set-200-bijoux-btn"
            onClick={handleSet200Bijoux}
            disabled={isSetting200}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-3 rounded-2xl cursor-pointer hover:shadow-md active:scale-95 transition-all text-xs border border-slate-700"
            title={language === 'fr' ? 'Générer et synchroniser 200 bijoux dans le catalogue' : 'تحديث القائمة إلى 200 قطعة إكسسوار'}
          >
            <Sparkles size={15} className="text-amber-400" />
            <span>{isSetting200 ? '...' : (language === 'fr' ? 'Recharger 200 Bijoux' : 'تعبئة 200 إكسسوار')}</span>
          </button>

          <button
            id="add-bijou-top-btn"
            onClick={openAddForm}
            className="flex items-center gap-2 bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white font-bold px-5 py-3 rounded-2xl cursor-pointer hover:shadow-lg hover:shadow-violet-500/20 active:scale-95 transition-all text-sm"
          >
            <Plus size={16} />
            <span>{language === 'fr' ? 'Ajouter un bijou' : 'إضافة إكسسوار جديد'}</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-5 rounded-[20px] border border-gray-200/80 shadow-sm space-y-4">
        <div className={`flex flex-col md:flex-row gap-4 ${isRtl ? 'md:flex-row-reverse' : ''}`}>
          {/* Search */}
          <div className="relative flex-1">
            <span className={`absolute inset-y-0 flex items-center text-gray-400 pointer-events-none ${isRtl ? 'left-4' : 'left-4'}`}>
              <Search size={18} />
            </span>
            <input
              id="bijoux-search-input"
              type="text"
              placeholder={t.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full py-3 pr-4 pl-11 bg-slate-50 border border-gray-200/80 rounded-2xl text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition-all ${
                isRtl ? 'text-right' : 'text-left'
              }`}
            />
          </div>

          {/* Status buttons */}
          <div className="flex gap-2 items-center flex-wrap">
            <button
              id="bijou-status-all"
              onClick={() => setSelectedStatus('all')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedStatus === 'all' ? 'bg-violet-600 text-white' : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
              }`}
            >
              {t.all}
            </button>
            <button
              id="bijou-status-disp"
              onClick={() => setSelectedStatus('disponible')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedStatus === 'disponible' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {t.statut_disponible}
            </button>
            <button
              id="bijou-status-loc"
              onClick={() => setSelectedStatus('en_location')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedStatus === 'en_location' ? 'bg-violet-600 text-white' : 'bg-slate-50 text-violet-600 hover:bg-violet-50'
              }`}
            >
              {t.statut_en_location}
            </button>
            <button
              id="bijou-status-ent"
              onClick={() => setSelectedStatus('en_entretien')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedStatus === 'en_entretien' ? 'bg-gray-600 text-white' : 'bg-slate-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.statut_en_entretien}
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredBijoux.length === 0 ? (
        <div className="bg-white py-16 px-4 rounded-[20px] border border-gray-200/80 shadow-sm text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Search size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">{language === 'fr' ? 'Aucun accessoire trouvé' : 'لا توجد حلي مطابقة'}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {language === 'fr' ? 'Veuillez modifier votre terme de recherche.' : 'يرجى تغيير معيار البحث.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredBijoux.map(bijou => (
            <div
              key={bijou.id}
              className="bg-white rounded-[20px] overflow-hidden border border-gray-200/80 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between"
            >
              <div className="relative aspect-square bg-slate-100 overflow-hidden shrink-0">
                <img
                  src={bijou.photo || (bijou.photos && bijou.photos[0]) || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=400'}
                  alt={bijou.nom}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className={`absolute top-3.5 ${isRtl ? 'left-3.5' : 'right-3.5'} z-10`}>
                  {renderStatusBadge(bijou.statut)}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide bg-violet-50 px-2 py-0.5 rounded-md">
                    {bijou.categorie}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-violet-600 transition-colors mt-2.5">
                    {bijou.nom}
                  </h3>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                    {bijou.description || (language === 'fr' ? 'Aucune description.' : 'لا يوجد وصف.')}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-50">
                  <div className={`flex justify-between items-baseline mb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] text-gray-400 font-semibold">{t.jewelry_price}</span>
                    <span className="text-base font-extrabold text-violet-600">{formatDa(bijou.prix_location_da)}</span>
                  </div>

                  <div className={`flex gap-1.5 pt-1 border-t border-dashed border-gray-200/80 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <button
                      id={`edit-bijou-btn-${bijou.id}`}
                      onClick={(e) => openEditForm(bijou, e)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-violet-50 text-gray-600 hover:text-violet-600 text-[11px] font-bold border border-slate-100 cursor-pointer flex items-center justify-center gap-1 transition-all"
                    >
                      <Edit3 size={11} />
                      <span>{t.edit}</span>
                    </button>

                    <button
                      id={`maintenance-bijou-btn-${bijou.id}`}
                      onClick={(e) => toggleMaintenance(bijou.id, bijou.statut, e)}
                      disabled={bijou.statut === 'en_location'}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center justify-center transition-all ${
                        bijou.statut === 'en_entretien'
                          ? 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100'
                          : 'bg-slate-50 border-slate-100 text-gray-600 hover:bg-slate-100 disabled:opacity-40'
                      }`}
                    >
                      <Wrench size={11} />
                    </button>

                    <button
                      id={`delete-bijou-btn-${bijou.id}`}
                      onClick={(e) => handleDelete(bijou.id, e)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200/80 hover:border-red-200/80 rounded-lg cursor-pointer flex items-center justify-center transition-all duration-200"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setIsFormOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col z-10 animate-slide-in">
            <div className={`p-6 border-b border-gray-200/80 flex justify-between items-center bg-slate-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingBijou 
                    ? (language === 'fr' ? 'Modifier l\'accessoire' : 'تعديل الإكسسوار') 
                    : (language === 'fr' ? 'Ajouter un accessoire' : 'إضافة إكسسوار جديد')}
                </h3>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{t.jewelry_name} *</label>
                <input
                  id="form-bijou-name"
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex: Khit Errouh Royale"
                  className={`w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">{t.jewelry_category} *</label>
                  <input
                    id="form-bijou-cat"
                    type="text"
                    required
                    value={categorie}
                    onChange={(e) => setCategorie(e.target.value)}
                    placeholder="Ex: Collier, Ceinture..."
                    className={`w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                      isRtl ? 'text-right' : 'text-left'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">{t.jewelry_price} (DA) *</label>
                  <input
                    id="form-bijou-price"
                    type="number"
                    min="0"
                    required
                    value={prix}
                    onChange={(e) => setPrix(Number(e.target.value))}
                    className="w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{t.status}</label>
                <select
                  id="form-bijou-status"
                  value={statut}
                  onChange={(e) => setStatut(e.target.value as typeof statut)}
                  className="w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
                >
                  <option value="disponible">{t.statut_disponible}</option>
                  <option value="en_entretien">{t.statut_en_entretien}</option>
                  {editingBijou && <option value="reserve">{t.statut_reservee}</option>}
                  {editingBijou && <option value="en_location">{t.statut_en_location}</option>}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{t.description}</label>
                <textarea
                  id="form-bijou-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Détails du métal, ornements..."
                  className={`w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 block">{language === 'fr' ? 'Photos de l’accessoire' : 'صور الإكسسوار'}</label>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    dragActive ? 'border-violet-500 bg-violet-50/50' : 'border-gray-200 bg-slate-50/50 hover:bg-slate-50 hover:border-violet-300'
                  }`}
                >
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                  
                  {isUploadingImage ? (
                    <div className="space-y-2 text-violet-600 flex flex-col items-center py-4">
                      <Loader2 size={28} className="animate-spin text-violet-600" />
                      <p className="text-xs font-semibold">
                        {language === 'fr' 
                          ? `Envoi des images séquentiellement (${uploadProgress?.current || 1}/${uploadProgress?.total || 1})...` 
                          : `جاري رفع الصور بالتتابع (${uploadProgress?.current || 1}/${uploadProgress?.total || 1})...`}
                      </p>
                    </div>
                  ) : photo ? (
                    <div className="space-y-3">
                      <div className="relative w-28 h-28 mx-auto rounded-xl overflow-hidden border border-gray-200/80 shadow-sm">
                        <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          id="clear-bijou-photo-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhoto('');
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium">
                        {language === 'fr' ? 'Cliquez ou glissez pour ajouter d’autres photos' : 'انقر أو اسحب لإضافة صور أخرى'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-gray-500 flex flex-col items-center">
                      <Upload size={20} className="text-gray-400" />
                      <p className="text-xs font-semibold">
                        {language === 'fr' ? 'Glissez-déposez des images ou cliquez pour parcourir' : 'اسحب صوراً هنا أو اضغط للتصفح'}
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
                          <img src={url} alt={`Secondary bijou ${idx}`} className="w-full h-full object-cover" />
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

                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">OU URL directe</span>
                  <input
                    id="form-bijou-photo-url"
                    type="text"
                    value={photo.startsWith('data:') ? '' : photo}
                    onChange={(e) => setPhoto(e.target.value)}
                    placeholder="https://example.com/jewelry.jpg"
                    className="w-full p-2.5 border border-gray-200/80 rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-50 flex gap-3">
                <button
                  type="button"
                  id="cancel-bijou-form"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-50 hover:bg-slate-100 text-gray-700 text-sm font-semibold rounded-xl cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  id="submit-bijou-form"
                  className="flex-1 py-3 px-4 bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white text-sm font-bold rounded-xl cursor-pointer"
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
