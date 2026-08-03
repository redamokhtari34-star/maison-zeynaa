import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Columns3, Rows3, FileSpreadsheet, Download, Check } from 'lucide-react';
import { Language, NotebookSheet } from '../types';
import { getNotebook, saveNotebook } from '../lib/storage';

interface BlocNotesProps {
  language: Language;
}

export default function BlocNotes({ language }: BlocNotesProps) {
  const isRtl = language === 'ar';
  const [sheets, setSheets] = useState<NotebookSheet[]>(() => getNotebook());
  const [activeId, setActiveId] = useState(() => sheets[0]?.id ?? '');
  const [justSaved, setJustSaved] = useState(false);

  const active = sheets.find(s => s.id === activeId) ?? sheets[0];

  // Every edit is written straight back to storage, so nothing is lost if the
  // page is closed without an explicit save.
  useEffect(() => {
    saveNotebook(sheets);
  }, [sheets]);

  const update = (fn: (sheet: NotebookSheet) => NotebookSheet) =>
    setSheets(prev => prev.map(s => (s.id === active.id ? fn(s) : s)));

  const setCell = (row: number, col: number, value: string) =>
    update(s => ({
      ...s,
      lignes: s.lignes.map((r, i) => (i === row ? r.map((c, j) => (j === col ? value : c)) : r))
    }));

  const setColumn = (col: number, value: string) =>
    update(s => ({ ...s, colonnes: s.colonnes.map((c, i) => (i === col ? value : c)) }));

  const addRow = () => update(s => ({ ...s, lignes: [...s.lignes, s.colonnes.map(() => '')] }));

  const addColumn = () =>
    update(s => ({
      ...s,
      colonnes: [...s.colonnes, language === 'fr' ? `Colonne ${s.colonnes.length + 1}` : `عمود ${s.colonnes.length + 1}`],
      lignes: s.lignes.map(r => [...r, ''])
    }));

  const removeRow = (row: number) =>
    update(s => ({ ...s, lignes: s.lignes.filter((_, i) => i !== row) }));

  const removeColumn = (col: number) =>
    update(s => ({
      ...s,
      colonnes: s.colonnes.filter((_, i) => i !== col),
      lignes: s.lignes.map(r => r.filter((_, j) => j !== col))
    }));

  const addSheet = () => {
    const sheet: NotebookSheet = {
      id: `sheet-${Date.now()}`,
      nom: language === 'fr' ? `Feuille ${sheets.length + 1}` : `ورقة ${sheets.length + 1}`,
      colonnes: language === 'fr'
        ? ['Désignation', 'Quantité', 'Montant (DA)', 'Remarque']
        : ['البيان', 'الكمية', 'المبلغ', 'ملاحظة'],
      lignes: Array.from({ length: 6 }, () => ['', '', '', ''])
    };
    setSheets(prev => [...prev, sheet]);
    setActiveId(sheet.id);
  };

  const removeSheet = (id: string) => {
    if (sheets.length === 1) return;
    const next = sheets.filter(s => s.id !== id);
    setSheets(next);
    if (activeId === id) setActiveId(next[0].id);
  };

  // CSV keeps the grid openable in Excel, which is the point of the module.
  const exportCsv = () => {
    const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const csv = [active.colonnes, ...active.lignes].map(r => r.map(escape).join(';')).join('\n');
    // The BOM makes Excel read the accents correctly.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${active.nom.replace(/\s+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2400);
  };

  if (!active) return null;

  return (
    <div className={`mx-auto max-w-[1200px] space-y-6 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Head */}
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
        <div>
          <h2 className="font-display text-[2rem] leading-tight text-neutral-900">
            {language === 'fr' ? 'Bloc-notes Excel' : 'دفتر الملاحظات'}
          </h2>
          <p className="mt-1 text-[15px] text-neutral-500">
            {language === 'fr'
              ? 'Vos tableaux libres : inventaires, listes de courses, calculs rapides.'
              : 'جداولك الحرة: الجرد، قوائم الشراء، الحسابات السريعة.'}
          </p>
        </div>

        <div className={`flex shrink-0 items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={exportCsv}
            className={`flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            {justSaved ? <Check size={15} className="text-green-600" /> : <Download size={15} />}
            {justSaved
              ? (language === 'fr' ? 'Exporté' : 'تم التصدير')
              : (language === 'fr' ? 'Exporter en CSV' : 'تصدير CSV')}
          </button>
          <button
            onClick={addSheet}
            className={`flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <Plus size={15} />
            {language === 'fr' ? 'Nouvelle feuille' : 'ورقة جديدة'}
          </button>
        </div>
      </div>

      {/* Sheet tabs */}
      <div className={`flex flex-wrap items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
        {sheets.map(s => (
          <div
            key={s.id}
            className={`group flex items-center gap-1.5 rounded-xl border px-3 py-2 transition-colors ${
              s.id === active.id
                ? 'border-neutral-300 bg-white'
                : 'border-transparent bg-neutral-100 hover:bg-neutral-200/70'
            }`}
          >
            <FileSpreadsheet size={14} className="shrink-0 text-neutral-500" />
            <input
              value={s.nom}
              onChange={(e) => setSheets(prev => prev.map(x => (x.id === s.id ? { ...x, nom: e.target.value } : x)))}
              onFocus={() => setActiveId(s.id)}
              className="w-28 bg-transparent text-sm font-medium text-neutral-800 outline-none"
            />
            {sheets.length > 1 && (
              <button
                onClick={() => removeSheet(s.id)}
                aria-label={language === 'fr' ? 'Supprimer la feuille' : 'حذف الورقة'}
                className="text-neutral-300 transition-colors hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" dir="ltr">
            <thead>
              <tr className="bg-neutral-50">
                <th className="w-10 border-b border-r border-neutral-200 p-2 text-[11px] font-semibold text-neutral-400">#</th>
                {active.colonnes.map((col, j) => (
                  <th key={j} className="min-w-[160px] border-b border-r border-neutral-200 p-0">
                    <div className="flex items-center">
                      <input
                        value={col}
                        onChange={(e) => setColumn(j, e.target.value)}
                        className="w-full bg-transparent px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-600 outline-none focus:bg-white"
                      />
                      {active.colonnes.length > 1 && (
                        <button
                          onClick={() => removeColumn(j)}
                          aria-label={language === 'fr' ? 'Supprimer la colonne' : 'حذف العمود'}
                          className="px-2 text-neutral-300 transition-colors hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-10 border-b border-neutral-200" />
              </tr>
            </thead>
            <tbody>
              {active.lignes.map((row, i) => (
                <tr key={i} className="hover:bg-neutral-50/60">
                  <td className="border-b border-r border-neutral-200 bg-neutral-50 p-2 text-center text-[11px] tabular-nums text-neutral-400">
                    {i + 1}
                  </td>
                  {row.map((cell, j) => (
                    <td key={j} className="border-b border-r border-neutral-200 p-0">
                      <input
                        value={cell}
                        onChange={(e) => setCell(i, j, e.target.value)}
                        className="w-full bg-transparent px-3 py-2.5 text-neutral-800 outline-none focus:bg-orange-50/50"
                      />
                    </td>
                  ))}
                  <td className="border-b border-neutral-200 text-center">
                    <button
                      onClick={() => removeRow(i)}
                      aria-label={language === 'fr' ? 'Supprimer la ligne' : 'حذف السطر'}
                      className="px-2 text-neutral-300 transition-colors hover:text-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 border-t border-neutral-200 bg-neutral-50 p-3">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300"
          >
            <Rows3 size={13} />
            {language === 'fr' ? 'Ajouter une ligne' : 'إضافة سطر'}
          </button>
          <button
            onClick={addColumn}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300"
          >
            <Columns3 size={13} />
            {language === 'fr' ? 'Ajouter une colonne' : 'إضافة عمود'}
          </button>
          <span className="ml-auto text-[11px] text-neutral-400">
            {language === 'fr' ? 'Enregistré automatiquement' : 'حفظ تلقائي'}
          </span>
        </div>
      </div>
    </div>
  );
}
