import { Dress, Bijou, Cliente, Reservation, Transaction, HistoriqueAction, StoreProfile } from '../types';

export const sampleDresses: Dress[] = generateAdditionalDresses(78, 1).map(d => ({ ...d, statut: 'disponible' as const }));

export function generate200Bijoux(): Bijou[] {
  const categories = [
    'Khit Errouh / Frontal',
    'Ceinture Dorée',
    'Collier Traditional / Mhelma',
    'Parure Complète',
    'Boucles d\'oreilles / Skhab',
    'Bracelet / Meskiya',
    'Chedda Accessories',
    'Diadème & Couronne'
  ];

  const categoryNames: Record<string, string[]> = {
    'Khit Errouh / Frontal': [
      'Khit Errouh "Sultana"', 'Khit Errouh "Amira" Fil d\'Or', 'Khit Errouh "Bahia" Émeraudes',
      'Khit Errouh "Zeyna" Rubis', 'Khit Errouh "Perles de la Casbah"', 'Khit Errouh "Yasmine" Royal',
      'Khit Errouh "Dihya" Argent', 'Khit Errouh "Rania" Diamants', 'Khit Errouh "Kahina" Traditionnel'
    ],
    'Ceinture Dorée': [
      'Ceinture de Caisse Ciselée Royale', 'Ceinture Louis d\'Or Algéroise', 'Ceinture Semsama Filigranée',
      'Ceinture Cintrée Karakou', 'Ceinture "Bahja" en Plaqué Or', 'Ceinture Caftan Brocart Dorée',
      'Ceinture "Zomorrod" Pierres Vertes', 'Ceinture Ciselée Constantinoise'
    ],
    'Collier Traditional / Mhelma': [
      'Collier Mhelma Kabyle Argent & Corail', 'Collier Skhab Ambre & Ciselure', 'Collier "Meskiya" de Tlemcen',
      'Collier "Kravata" Algéroise', 'Collier "Bakhrouk" Traditionnel', 'Collier Skhab Parfum d\'Orient',
      'Collier "Lihia" Tlemcenia', 'Collier Mhelma Impériale'
    ],
    'Parure Complète': [
      'Parure Constantine "Majboud" 24K', 'Parure Tlemcen Chedda Royale', 'Parure "Zeyna" Or Massif',
      'Parure Algéroise "Sultana"', 'Parure Mariée "Kahina"', 'Parure "Yasmine" Diamants & Cristal',
      'Parure Kabyle "Thiziri" Argent', 'Parure Royale "El-Bahja"'
    ],
    'Boucles d\'oreilles / Skhab': [
      'Boucles "Taj" Diamants & Perles', 'Boucles "Chandelie" Dorées', 'Boucles Kabyles Émail & Corail',
      'Boucles "Khit Errouh" Assorties', 'Boucles Gouttes d\'Or "Rania"', 'Boucles Ciselées "Amira"',
      'Boucles "Skhab" Ambre Pur'
    ],
    'Bracelet / Meskiya': [
      'Bracelet Meskiya Traditionnel Zghab', 'Bracelet Kholkhal Argent & Pierres', 'Bracelet "Mebrouma" Doré',
      'Bracelet "Sert" Constantinois', 'Bracelet Ring-Bracelet "Kef"', 'Kholkhal Algérois Traditionnel',
      'Bracelet Manschette Filigrane'
    ],
    'Chedda Accessories': [
      'Accessoires Chedda Tlemcenia "Zerouf"', 'Jebine Chedda Or & Perles', 'Rendouka Chedda Traditionnelle',
      'Chachia Brodée Majboud & Bijoux', 'Couronne Chedda Royale "Amira"'
    ],
    'Diadème & Couronne': [
      'Diadème "Yasmine" Perles de Culture', 'Couronne Royale Scintillante', 'Diadème "Nour" Diamants',
      'Couronne Mariée "Bahia" Or Rose', 'Diadème Princesse "Sultana"'
    ]
  };

  const images = [
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1611085583191-a3b1a30a5a4a?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1598560917505-59a3ad559071?auto=format&fit=crop&q=80&w=400'
  ];

  const statuses: ('disponible' | 'reserve' | 'en_location' | 'en_entretien')[] = [
    'disponible'
  ];

  const list: Bijou[] = [];

  for (let i = 1; i <= 200; i++) {
    const category = categories[(i - 1) % categories.length];
    const names = categoryNames[category];
    const baseName = names[(i - 1) % names.length];
    const variation = Math.floor((i - 1) / names.length);
    const nom = variation > 0 ? `${baseName} Modèle #${variation + 1}` : baseName;

    const basePrice = 2500 + ((i * 350) % 7500);
    const photo = images[i % images.length];
    const statut = statuses[i % statuses.length];

    const day = (1 + (i % 28)).toString().padStart(2, '0');
    const month = (1 + (i % 12)).toString().padStart(2, '0');

    list.push({
      id: `b-${i}`,
      nom,
      categorie: category,
      prix_location_da: basePrice,
      description: `Magnifique ${category.toLowerCase()} authentique de la collection Maison Zeyna. Confection et ciselure de haute qualité pour cérémonies et fêtes.`,
      photo,
      statut,
      date_creation: `2026-${month}-${day}T12:00:00Z`
    });
  }

  return list;
}

export const sampleBijoux: Bijou[] = generate200Bijoux();

export const sampleClientes: Cliente[] = [];

export const sampleReservations: Reservation[] = [];

export const sampleTransactions: Transaction[] = [];

export const sampleHistory: HistoriqueAction[] = [];

export const defaultStoreProfile: StoreProfile = {
  nom: 'Maison Zeyna',
  telephone: '0550 12 34 56',
  adresse: 'Villa N° 24, Rue Didouche Mourad, Alger Centre, Algérie',
  instagram: '@maison_zeyna_alger',
  facebook: 'Maison Zeyna Haute Couture'
};

export function generateAdditionalDresses(count: number = 70, startOffset: number = Date.now()): Dress[] {
  const categories: ('caftan' | 'karakou' | 'chaouia' | 'kabyle' | 'badroune' | 'soiree' | 'autre')[] = [
    'caftan', 'karakou', 'chaouia', 'kabyle', 'badroune', 'soiree', 'autre'
  ];

  const colors = [
    'Vert Émeraude', 'Rouge Grenat', 'Bleu Majorelle', 'Blanc Soie', 'Noir Impérial',
    'Fuchsia Éclatant', 'Turquoise Pastel', 'Or Rose', 'Violet Royal', 'Jaune Moutarde',
    'Vert Menthe', 'Rose Poudré', 'Gris Perle', 'Bordeaux Majestueux', 'Bleu Roi'
  ];

  const sizes = ['36 (S)', '38 (M)', '40 (M/L)', '42 (L)', '44 (XL)', '46 (XXL)', 'Unique'];

  const namesByCategory: Record<string, string[]> = {
    caftan: ['Caftan Royal de Tlemcen', 'Caftan "Rania" en Crêpe de Soie', 'Caftan Velours Émeraude', 'Caftan de Mariée "Nour"'],
    karakou: ['Karakou Moderne "Sultana"', 'Karakou Velours Souiri', 'Karakou Brodé "Yasmine"', 'Karakou de Fête "Bahia"'],
    chaouia: ['Melhfa Chaouia Dorée', 'Melhfa Traditionnelle Noire', 'Robe Chaouia Royale Rose'],
    kabyle: ['Robe Kabyle de Fête "Tafsut"', 'Robe Kabyle Traditionnelle "Dihya"', 'Robe Kabyle en Lin "Idurar"'],
    badroune: ['Badroune Crêpe "Yasmine"', 'Badroune Satin Bleu', 'Badroune Blanc Ciselé'],
    soiree: ['Robe de Soirée Satin Vert', 'Robe Mousseline "Aura"', 'Robe d\'Honneur en Satin Doré'],
    autre: ['Chedda Tlemcenia Impériale', 'Djeba Constantinoise "Mejboud"', 'Blousa Oranaise Traditionnelle']
  };

  const unsplashImages: Record<string, string[]> = {
    caftan: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=600'],
    karakou: ['https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600'],
    chaouia: ['https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=600'],
    kabyle: ['https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=600'],
    badroune: ['https://images.unsplash.com/photo-1596783074918-c84cb06531ca?auto=format&fit=crop&q=80&w=600'],
    soiree: ['https://images.unsplash.com/photo-1518049360754-ee01262d4991?auto=format&fit=crop&q=80&w=600'],
    autre: ['https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600']
  };

  const newDresses: Dress[] = [];
  for (let i = 0; i < count; i++) {
    const idx = startOffset + i;
    const category = categories[i % categories.length];
    const categoryNames = namesByCategory[category];
    const nom = `${categoryNames[i % categoryNames.length]} Collection 2026 #${i + 1}`;
    const couleur = colors[(i * 2) % colors.length];
    const taille = sizes[(i * 3) % sizes.length];
    const basePrice = 14000 + ((i * 400) % 8000);
    const caution = Math.floor(basePrice * 0.6 / 1000) * 1000;
    const categoryImgs = unsplashImages[category];

    newDresses.push({
      id: `d-${idx}`,
      nom,
      categorie: category,
      couleur,
      taille,
      prix_location_da: basePrice,
      caution_da: caution,
      description: `Magnifique modèle ${nom} confectionné en tissu ${couleur}, taille ${taille}. Collection prestige Maison Zeyna.`,
      photo_principale: categoryImgs[i % categoryImgs.length],
      photos: [],
      statut: 'disponible',
      date_creation: new Date().toISOString()
    });
  }

  return newDresses;
}
