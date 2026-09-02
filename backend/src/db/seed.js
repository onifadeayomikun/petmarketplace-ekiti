// Seeds the VetConnect Ekiti database with realistic demo data.
// Idempotent: wipes data tables (keeps `roles`) then re-inserts.
// Usage: npm run seed
import { pool, query } from './pool.js';
import { hashPassword } from '../utils/password.js';

const DEMO_PASSWORD = 'Password123';

// ---- small date helpers (normal Node script — real Date math is fine) -------
const DAY = 24 * 60 * 60 * 1000;
const today = new Date();
const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (n, base = today) => ymd(new Date(base.getTime() + n * DAY));

// slugify helper (kept local to avoid extra deps in the seed)
const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

async function seed() {
  console.log('[seed] 🌱 Starting VetConnect Ekiti seed …');

  // -------------------------------------------------------------------------
  // 0. WIPE — keep roles, truncate everything else. CASCADE handles FK order.
  // -------------------------------------------------------------------------
  await query(`
    TRUNCATE TABLE
      analytics,
      notifications,
      emergency_requests,
      vaccinations,
      review_responses,
      reviews,
      appointments,
      appointment_slots,
      clinic_availability,
      animals,
      veterinarians,
      articles,
      categories,
      clinics,
      users
    RESTART IDENTITY CASCADE
  `);
  console.log('[seed] ✅ Wiped data tables (roles preserved)');

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // -------------------------------------------------------------------------
  // 1. USERS
  // -------------------------------------------------------------------------
  async function insertUser({ full_name, email, phone, role, location }) {
    const { rows } = await query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, location, is_active, is_email_verified)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,TRUE)
       RETURNING id`,
      [full_name, email, phone, passwordHash, role, location],
    );
    return rows[0].id;
  }

  // Super admin
  const adminId = await insertUser({
    full_name: 'System Administrator',
    email: 'admin@vetconnect.ng',
    phone: '+2348030000000',
    role: 'SUPER_ADMIN',
    location: 'Ikerre',
  });

  // Clinic admins (one per clinic)
  const clinicAdmins = [
    { full_name: 'Dr. Adewale Bello',     email: 'drbello@ikereanimalcare.ng',   phone: '+2348031110001', location: 'Ikerre' },
    { full_name: 'Dr. Chinwe Okafor',     email: 'drokafor@adovetclinic.ng',    phone: '+2348031110002', location: 'Ado-Ekiti' },
    { full_name: 'Dr. Ibrahim Suleiman',  email: 'drsuleiman@igedevet.ng',     phone: '+2348031110003', location: 'Igede' },
    { full_name: 'Dr. Folake Adeyemi',    email: 'dradeyemi@isepetcare.ng',    phone: '+2348031110004', location: 'Ise' },
    { full_name: 'Dr. Emeka Nwankwo',     email: 'drnwankwo@emurelivestock.ng',  phone: '+2348031110005', location: 'Emure' },
    { full_name: 'Dr. Halima Yusuf',      email: 'dryusuf@ikoletownvet.ng',     phone: '+2348031110006', location: 'Ikole' },
  ];
  const adminIds = [];
  for (const a of clinicAdmins) {
    adminIds.push(await insertUser({ ...a, role: 'CLINIC_ADMIN' }));
  }

  // Owners / farmers
  const owners = [
    { full_name: 'Tunde Bakare',     email: 'tunde.bakare@gmail.com',    phone: '+2348065550001', location: 'Ikerre' },
    { full_name: 'Ngozi Eze',        email: 'ngozi.eze@gmail.com',       phone: '+2348065550002', location: 'Ado-Ekiti' },
    { full_name: 'Yakubu Danladi',   email: 'yakubu.danladi@gmail.com',  phone: '+2348065550003', location: 'Igede' },
    { full_name: 'Bisi Olatunji',    email: 'bisi.olatunji@gmail.com',   phone: '+2348065550004', location: 'Ise' },
    { full_name: 'Samuel Ogunleye',  email: 'samuel.ogunleye@gmail.com', phone: '+2348065550005', location: 'Emure' },
  ];
  const ownerIds = [];
  for (const o of owners) {
    ownerIds.push(await insertUser({ ...o, role: 'OWNER' }));
  }
  console.log(`[seed] ✅ Users: 1 super admin, ${adminIds.length} clinic admins, ${ownerIds.length} owners`);

  // -------------------------------------------------------------------------
  // 2. CLINICS  (>= 8). animal_types cast to animal_species[]
  // -------------------------------------------------------------------------
  const clinicDefs = [
    {
      name: 'Ikere Animal Care Centre',
      ownerIdx: 0,
      description: 'Full-service veterinary clinic serving Ikerre-Ekiti and surrounding communities with companion-animal and livestock care.',
      address: '14 College Road, Opposite Ikere Town Hall, Ikerre-Ekiti',
      town: 'Ikerre',
      phone: '+2348031110001',
      email: 'hello@ikereanimalcare.ng',
      services: ['Vaccination', 'Surgery', 'Deworming', 'Consultation', 'Emergency Care'],
      animals: ['DOG', 'CAT', 'POULTRY', 'GOAT'],
      emergency: true,
      lat: 7.4950, lng: 5.2310,
      status: 'APPROVED',
    },
    {
      name: 'Ado Veterinary Clinic',
      ownerIdx: 1,
      description: 'Trusted neighbourhood vet clinic in Ado-Ekiti offering preventive care, vaccinations and minor surgery for pets and farm animals.',
      address: '22 Secretariat Road, Beside Fajuyi Park, Ado-Ekiti',
      town: 'Ado-Ekiti',
      phone: '+2348031110002',
      email: 'care@adovetclinic.ng',
      services: ['Vaccination', 'Deworming', 'Consultation', 'Poultry Health', 'Artificial Insemination'],
      animals: ['DOG', 'CAT', 'POULTRY', 'CATTLE', 'GOAT', 'SHEEP'],
      emergency: false,
      lat: 7.6211, lng: 5.2214,
      status: 'APPROVED',
    },
    {
      name: 'Igede Livestock & Pet Hospital',
      ownerIdx: 2,
      description: 'Specialised livestock and poultry health hospital in Igede supporting smallholder farmers with herd health programmes.',
      address: '15 Iyin Road, Igede-Ekiti',
      town: 'Igede',
      phone: '+2348031110003',
      email: 'info@igedevet.ng',
      services: ['Poultry Health', 'Vaccination', 'Deworming', 'Artificial Insemination', 'Consultation', 'Surgery'],
      animals: ['POULTRY', 'CATTLE', 'GOAT', 'SHEEP', 'RABBIT'],
      emergency: true,
      lat: 7.6710, lng: 5.1320,
      status: 'APPROVED',
    },
    {
      name: 'Ise Pet Care Clinic',
      ownerIdx: 3,
      description: 'Modern companion-animal clinic in Ise focused on dogs, cats and small pets with diagnostics and grooming.',
      address: '8 Palace Way, Ise-Ekiti',
      town: 'Ise',
      phone: '+2348031110004',
      email: 'reception@isepetcare.ng',
      services: ['Vaccination', 'Consultation', 'Surgery', 'Deworming', 'Emergency Care'],
      animals: ['DOG', 'CAT', 'RABBIT'],
      emergency: true,
      lat: 7.4648, lng: 5.4244,
      status: 'APPROVED',
    },
    {
      name: 'Emure Livestock Veterinary Services',
      ownerIdx: 4,
      description: 'Rural-focused veterinary service in Emure providing cattle, goat and poultry health support to farming cooperatives.',
      address: 'Km 3 Eporo Road, Emure-Ekiti',
      town: 'Emure',
      phone: '+2348031110005',
      email: 'contact@emurelivestock.ng',
      services: ['Poultry Health', 'Artificial Insemination', 'Vaccination', 'Deworming', 'Consultation'],
      animals: ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY'],
      emergency: false,
      lat: 7.4333, lng: 5.4667,
      status: 'APPROVED',
    },
    {
      name: 'Ikole Veterinary Hospital',
      ownerIdx: 5,
      description: 'Mid-sized veterinary hospital in Ikole offering 24/7 emergency care and full surgical theatre.',
      address: '45 Oye Road, Ikole-Ekiti',
      town: 'Ikole',
      phone: '+2348031110006',
      email: 'emergency@ikoletownvet.ng',
      services: ['Emergency Care', 'Surgery', 'Vaccination', 'Consultation', 'Deworming', 'Poultry Health'],
      animals: ['DOG', 'CAT', 'POULTRY', 'CATTLE', 'GOAT', 'SHEEP', 'RABBIT'],
      emergency: true,
      lat: 7.7981, lng: 5.5144,
      status: 'APPROVED',
    },
    {
      name: 'Hillside Poultry Health Centre',
      ownerIdx: 2,
      description: 'Dedicated poultry health centre serving commercial farms across Ikerre and Ado with biosecurity advisory.',
      address: '12 Afao Road, Ikerre-Ekiti',
      town: 'Ikerre',
      phone: '+2348031110007',
      email: 'farm@hillsidepoultry.ng',
      services: ['Poultry Health', 'Vaccination', 'Deworming', 'Consultation'],
      animals: ['POULTRY'],
      emergency: false,
      lat: 7.5020, lng: 5.2380,
      status: 'PENDING',
    },
    {
      name: 'Ekiti Mobile Vet Clinic',
      ownerIdx: 0,
      description: 'Mobile veterinary unit covering Ikerre, Ado-Ekiti and surrounding towns for home consultations and farm visits.',
      address: 'Plot 5 GRA Extension, Ikerre-Ekiti (Mobile service)',
      town: 'Ikerre',
      phone: '+2348031110008',
      email: 'book@ekitimobilevet.ng',
      services: ['Consultation', 'Vaccination', 'Deworming', 'Emergency Care'],
      animals: ['DOG', 'CAT', 'GOAT', 'POULTRY'],
      emergency: true,
      lat: 7.4890, lng: 5.2280,
      status: 'PENDING',
    },
  ];

  // Mon-Sat operating hours; clinics with emergency get a slightly longer day.
  const buildHours = (open, close) => ({
    mon: { open, close },
    tue: { open, close },
    wed: { open, close },
    thu: { open, close },
    fri: { open, close },
    sat: { open, close: '14:00' },
  });

  const clinicIds = [];
  for (const c of clinicDefs) {
    const hours = buildHours('08:00', c.emergency ? '20:00' : '17:00');
    const { rows } = await query(
      `INSERT INTO clinics
         (owner_id, name, slug, description, address, town, phone, email,
          operating_hours, services_offered, animal_types, emergency_available,
          latitude, longitude, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::animal_species[],$12,$13,$14,$15)
       RETURNING id`,
      [
        adminIds[c.ownerIdx],
        c.name,
        slugify(c.name),
        c.description,
        c.address,
        c.town,
        c.phone,
        c.email,
        JSON.stringify(hours),
        c.services,
        c.animals,
        c.emergency,
        c.lat,
        c.lng,
        c.status,
      ],
    );
    clinicIds.push({ id: rows[0].id, ...c });
  }
  const approvedClinics = clinicIds.filter((c) => c.status === 'APPROVED');
  console.log(`[seed] ✅ Clinics: ${clinicIds.length} (${approvedClinics.length} approved)`);

  // -------------------------------------------------------------------------
  // 3. VETERINARIANS  (1-3 per clinic)
  // -------------------------------------------------------------------------
  const vetPool = [
    { full_name: 'Dr. Adewale Bello',    specialization: 'Small Animal Medicine',  status: 'VERIFIED' },
    { full_name: 'Dr. Ngozi Aluko',      specialization: 'Veterinary Surgery',     status: 'VERIFIED' },
    { full_name: 'Dr. Musa Garba',       specialization: 'Poultry & Avian Health', status: 'VERIFIED' },
    { full_name: 'Dr. Chinwe Okafor',    specialization: 'Companion Animals',      status: 'VERIFIED' },
    { full_name: 'Dr. Tobi Afolabi',     specialization: 'Large Animal & Cattle',  status: 'VERIFIED' },
    { full_name: 'Dr. Ibrahim Suleiman', specialization: 'Livestock Reproduction', status: 'VERIFIED' },
    { full_name: 'Dr. Folake Adeyemi',   specialization: 'Internal Medicine',      status: 'VERIFIED' },
    { full_name: 'Dr. Emeka Nwankwo',    specialization: 'Herd Health',            status: 'PENDING' },
    { full_name: 'Dr. Halima Yusuf',     specialization: 'Emergency & Critical Care', status: 'VERIFIED' },
    { full_name: 'Dr. Segun Olaniyi',    specialization: 'Dermatology & Parasitology', status: 'PENDING' },
  ];

  let vetCursor = 0;
  let licenseCounter = 1001;
  const vetIdsByClinic = {}; // clinicId -> [vetId,...]
  for (const c of clinicIds) {
    const count = 1 + (vetCursor % 3); // 1..3 vets
    vetIdsByClinic[c.id] = [];
    for (let i = 0; i < count; i++) {
      const v = vetPool[vetCursor % vetPool.length];
      vetCursor++;
      const { rows } = await query(
        `INSERT INTO veterinarians
           (clinic_id, full_name, license_number, specialization, bio, status)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [
          c.id,
          v.full_name,
          `VCN/EK/${licenseCounter++}`,
          v.specialization,
          `${v.full_name} is a licensed veterinarian specialising in ${v.specialization.toLowerCase()} at ${c.name}.`,
          v.status,
        ],
      );
      vetIdsByClinic[c.id].push(rows[0].id);
    }
  }
  console.log(`[seed] ✅ Veterinarians: ${vetCursor} total`);

  // -------------------------------------------------------------------------
  // 4. CATEGORIES + ARTICLES
  // -------------------------------------------------------------------------
  const categoryDefs = [
    { name: 'Dogs',          species: 'DOG',    description: 'Health, vaccination and care guidance for dogs.' },
    { name: 'Cats',          species: 'CAT',    description: 'Care, nutrition and parasite control for cats.' },
    { name: 'Poultry',       species: 'POULTRY',description: 'Disease prevention and biosecurity for poultry farms.' },
    { name: 'Goats',         species: 'GOAT',   description: 'Goat husbandry, deworming and disease control.' },
    { name: 'Cattle',        species: 'CATTLE', description: 'Cattle herd health, vaccination and management.' },
    { name: 'Emergency Care',species: null,     description: 'First-aid and emergency response for all animals.' },
  ];
  const categoryIds = {}; // name -> id
  for (const cat of categoryDefs) {
    const { rows } = await query(
      `INSERT INTO categories (name, slug, species, description)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [cat.name, slugify(cat.name), cat.species, cat.description],
    );
    categoryIds[cat.name] = rows[0].id;
  }

  const articleDefs = [
    {
      category: 'Dogs',
      title: 'Anti-Rabies Vaccination for Dogs: What Every Owner Must Know',
      excerpt: 'Rabies is fatal but completely preventable. Learn when and how to vaccinate your dog under Nigerian conditions.',
      tags: ['rabies', 'vaccination', 'dogs'],
      body: `Rabies remains one of the most dangerous zoonotic diseases in Nigeria, and dogs are the primary source of human infection. The good news is that it is 100% preventable through vaccination.

Puppies should receive their first anti-rabies vaccine at 12 weeks of age. A booster is given one year later, and thereafter the vaccine is repeated annually. In high-risk areas such as Ekiti State, annual boosters are strongly recommended and are often required by local authorities.

If your dog bites a person, isolate the animal immediately and contact a veterinarian. Never abandon or kill the dog, as a 10-day observation period is the safest way to confirm whether rabies is present.

Keep your dog's vaccination card up to date and store it safely. A vaccinated dog protects not only itself but your entire household and community.`,
    },
    {
      category: 'Dogs',
      title: 'The DHPP Vaccination Schedule Explained',
      excerpt: 'DHPP protects dogs against distemper, hepatitis, parvovirus and parainfluenza. Here is the recommended schedule.',
      tags: ['dhpp', 'puppy', 'vaccination', 'dogs'],
      body: `DHPP is a combination vaccine that protects dogs against four serious diseases: Distemper, Hepatitis (adenovirus), Parvovirus and Parainfluenza. Parvovirus in particular kills many unvaccinated puppies in Nigeria each year.

The core puppy series begins at 6-8 weeks of age, with boosters every 3-4 weeks until the puppy is about 16 weeks old. This staggered schedule ensures protection as the antibodies passed from the mother fade away.

Adult dogs receive a DHPP booster one year after the puppy series, and then every 1-3 years depending on risk and your veterinarian's advice.

Until the full puppy series is complete, avoid taking your puppy to high-traffic areas or markets where unvaccinated dogs gather. Early, complete vaccination is the single best investment in your dog's long-term health.`,
    },
    {
      category: 'Poultry',
      title: 'Preventing Newcastle Disease in Poultry Flocks',
      excerpt: 'Newcastle Disease can wipe out an entire flock within days. A strict vaccination programme is essential.',
      tags: ['newcastle', 'poultry', 'vaccination', 'biosecurity'],
      body: `Newcastle Disease (NDV) is the single most devastating viral disease of poultry in Nigeria, capable of killing an entire flock within days. Prevention through vaccination is far cheaper than the losses caused by an outbreak.

For broilers and layers, the typical programme uses the Lasota or I-2 thermostable vaccine. Day-old chicks are often vaccinated at the hatchery, followed by repeat doses at 2-3 weeks, 6-8 weeks, and then every few months for layers via drinking water or eye-drop application.

Signs of an outbreak include sudden death, greenish diarrhoea, twisted necks, gasping and a sharp drop in egg production. If you suspect Newcastle Disease, isolate affected birds and call a veterinarian immediately.

Vaccination must be combined with good biosecurity. Even a perfectly vaccinated flock can be overwhelmed if the farm is repeatedly exposed to the virus through visitors, equipment or wild birds.`,
    },
    {
      category: 'Poultry',
      title: 'Poultry Farm Biosecurity: A Practical Checklist',
      excerpt: 'Simple, low-cost biosecurity measures dramatically reduce disease on small and medium poultry farms.',
      tags: ['biosecurity', 'poultry', 'farm management'],
      body: `Biosecurity is the set of practices that stop disease from entering and spreading on your farm. For poultry keepers in Ikerre, Ado-Ekiti and across Ekiti State, good biosecurity is the difference between profit and ruin.

Control farm access. Limit visitors, and provide a footbath with disinfectant at every entrance. Workers should change into farm-only boots and clothing.

Practise all-in/all-out stocking where possible: fill a house with one batch, then clean and disinfect thoroughly before bringing in the next. This breaks the disease cycle.

Keep wild birds and rodents out, store feed in covered containers, and source day-old chicks only from reputable hatcheries. Dispose of dead birds promptly by deep burial or incineration — never dump carcasses near water or other birds.

A written daily routine and a simple visitor log are inexpensive tools that pay for themselves many times over.`,
    },
    {
      category: 'Cattle',
      title: 'Foot-and-Mouth Disease (FMD) in Cattle: Recognition and Control',
      excerpt: 'FMD spreads rapidly and causes severe production losses. Learn the signs and control measures.',
      tags: ['fmd', 'cattle', 'vaccination'],
      body: `Foot-and-Mouth Disease (FMD) is a highly contagious viral disease affecting cattle, goats, sheep and pigs. While rarely fatal in adult cattle, it causes severe production losses through weight loss, reduced milk and lameness.

The classic signs are blisters and ulcers on the tongue, gums, lips, between the hooves and on the teats. Affected animals drool heavily, go off feed, become lame and develop fever.

Control rests on vaccination, movement restriction and disinfection. In areas with regular outbreaks, vaccinate cattle every 6 months using a vaccine matched to the circulating strains. Isolate sick animals immediately and restrict movement on and off the farm.

Because FMD spreads through saliva, equipment, vehicles and even on clothing, disinfection of boots, tools and pens is critical. Report suspected outbreaks to veterinary authorities promptly.`,
    },
    {
      category: 'Cattle',
      title: 'Tick Control in Cattle: Protecting Against Tick-Borne Disease',
      excerpt: 'Ticks transmit anaplasmosis, babesiosis and heartwater. An integrated control plan keeps cattle healthy.',
      tags: ['ticks', 'cattle', 'parasite control'],
      body: `Ticks are more than a nuisance — they transmit serious diseases such as anaplasmosis, babesiosis (redwater) and heartwater that can cripple a cattle herd. Effective tick control is central to cattle health in southern Nigeria.

Use acaricides (tick dips or pour-ons) on a regular schedule, especially during the rainy season when tick numbers peak. Rotate between acaricide classes periodically to delay resistance.

Combine chemical control with pasture management: rotational grazing and clearing thick bush around kraals reduces the tick burden. Inspect animals regularly, paying attention to the ears, tail base, udder and underbelly where ticks gather.

Where tick-borne disease is common, discuss strategic vaccination and the careful use of "endemic stability" with your veterinarian, so that young animals develop immunity safely.`,
    },
    {
      category: 'Goats',
      title: 'Deworming Goats: Strategic Parasite Management',
      excerpt: 'Internal parasites are a leading cause of poor growth and death in goats. Strategic deworming saves money.',
      tags: ['deworming', 'goats', 'parasite control'],
      body: `Internal parasites, especially the barber's pole worm (Haemonchus), are a major killer of goats in Nigeria. Heavy worm burdens cause anaemia, bottle jaw (swelling under the chin), poor growth and death.

Rather than deworming blindly on a fixed calendar, practise strategic deworming. Deworm at key times — before the rains, before kidding, and when animals show signs of worm burden — and where possible use the FAMACHA eye-colour score to treat only the animals that need it.

Rotate dewormer classes and avoid under-dosing, as both drive drug resistance. Combine deworming with good pasture management: rotational grazing and avoiding overgrazing dramatically reduces re-infection.

Keep records of which animals are frequently affected; chronically wormy goats may be culled to build a more resistant herd over time.`,
    },
    {
      category: 'Cats',
      title: 'Parasite Control for Cats: Worms, Fleas and Ticks',
      excerpt: 'A simple routine of deworming and flea control keeps cats healthy and protects the household.',
      tags: ['cats', 'parasite control', 'deworming', 'fleas'],
      body: `Cats are commonly affected by roundworms, tapeworms, fleas and ear mites. Many of these parasites can also affect humans, so control protects the whole household.

Kittens should be dewormed every 2 weeks from 3 weeks of age until 12 weeks, then monthly to 6 months. Adult cats are typically dewormed every 3 months, or more often for outdoor hunters that eat rodents.

Fleas cause itching, skin disease and can transmit tapeworm. Use a veterinary-recommended spot-on or oral flea product, and treat all pets in the home at the same time. Never use dog flea products on cats — some are toxic to them.

Regularly check your cat's coat and ears, and bring any persistent scratching, hair loss or "rice grain" segments around the anus to your veterinarian's attention.`,
    },
    {
      category: 'Emergency Care',
      title: 'Recognising and Managing Heat Stress in Animals',
      excerpt: 'Nigerian heat can be deadly. Learn to spot heat stress early and cool an animal safely.',
      tags: ['heat stress', 'emergency', 'first aid'],
      body: `Heat stress is a serious risk during the hot, humid Nigerian dry season, affecting dogs, poultry, cattle and other animals. Recognising it early can save lives.

Early signs include heavy panting, drooling, restlessness and seeking shade. As it worsens, animals become weak and uncoordinated, may collapse, and in poultry you will see open-mouth breathing, drooping wings and sudden deaths in the flock.

To cool an affected animal, move it to shade immediately, offer cool (not ice-cold) water, and wet the body — especially the belly, paws and head — with cool water while increasing air movement with a fan or breeze. Avoid sudden ice-cold immersion, which can cause shock.

Prevention is best: provide constant access to clean water and shade, avoid transporting or working animals during the hottest hours, and ensure poultry houses have good ventilation. Seek veterinary help for any animal that collapses or does not recover quickly.`,
    },
    {
      category: 'Emergency Care',
      title: 'Animal Poisoning: First Aid Before You Reach the Vet',
      excerpt: 'Rodenticides, insecticides and toxic plants poison animals every year. Quick action matters.',
      tags: ['poisoning', 'emergency', 'first aid'],
      body: `Poisoning is a common emergency in companion animals and livestock. Common culprits include rodenticides (rat poison), insecticides, certain household chemicals, spoiled feed and toxic plants.

Signs vary with the poison but may include drooling, vomiting, diarrhoea, tremors, seizures, difficulty breathing, weakness or sudden collapse. If you suspect poisoning, act quickly but calmly.

Remove the animal from the source and prevent further exposure. If you know what was eaten, keep the container or a sample to show the veterinarian. Do NOT induce vomiting unless a veterinarian instructs you to — with some poisons this causes more harm.

Call your nearest veterinarian or emergency clinic immediately and follow their instructions. The faster the animal receives professional treatment, the better the chance of survival.`,
    },
    {
      category: 'Emergency Care',
      title: 'First Aid for Injuries and Wounds in Animals',
      excerpt: 'Knowing how to control bleeding and protect a wound buys time until veterinary care.',
      tags: ['injury', 'wounds', 'emergency', 'first aid'],
      body: `Cuts, bites, road injuries and trauma are frequent emergencies for both pets and livestock. Calm, correct first aid can prevent shock and infection while you reach a veterinarian.

For bleeding, apply firm, steady pressure with a clean cloth or gauze. Do not keep lifting the cloth to check — maintain pressure for several minutes. For a heavily bleeding limb, a pressure bandage can help, but avoid improvised tourniquets unless trained.

Approach an injured animal carefully; pain and fear can make even a gentle animal bite. Where safe, muzzle a dog with a soft cloth before handling.

Keep wounds clean by gently rinsing with clean water or saline, and cover with a clean dressing. Avoid applying engine oil, kerosene or harsh chemicals — these damage tissue. Transport the animal to a veterinarian as soon as bleeding is controlled, keeping it warm and as still as possible.`,
    },
    {
      category: 'Dogs',
      title: 'Routine Health Checks: Building a Wellness Routine for Your Dog',
      excerpt: 'Preventive care — not just treating illness — keeps dogs healthy and reduces long-term costs.',
      tags: ['wellness', 'preventive care', 'dogs'],
      body: `Many dog illnesses are cheaper and easier to manage when caught early. A simple wellness routine helps you do exactly that.

Schedule an annual veterinary check-up, even when your dog seems healthy. During the visit the vet can update vaccinations, check teeth, weight and body condition, and detect early signs of disease.

At home, observe your dog daily: appetite, energy, stool consistency, coat condition and any limping or lumps. Sudden changes in any of these are worth a call to your vet.

Keep up with parasite control — deworming and tick/flea prevention — and feed a balanced diet appropriate to your dog's age and size. Combined with fresh water, exercise and a clean environment, these basics prevent the majority of common health problems.`,
    },
  ];

  const articleIds = [];
  for (const a of articleDefs) {
    const { rows } = await query(
      `INSERT INTO articles
         (category_id, author_id, title, slug, excerpt, body, tags, is_published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
       RETURNING id`,
      [categoryIds[a.category], adminId, a.title, slugify(a.title), a.excerpt, a.body, a.tags],
    );
    articleIds.push(rows[0].id);
  }
  console.log(`[seed] ✅ Categories: ${categoryDefs.length}, Articles: ${articleIds.length}`);

  // -------------------------------------------------------------------------
  // 5. ANIMALS  (~8-10 across owners)
  // -------------------------------------------------------------------------
  const animalDefs = [
    { ownerIdx: 0, name: 'Rex',     species: 'DOG',     breed: 'German Shepherd',  gender: 'MALE',   age: 3,   weight: 32.5, color: 'Black & Tan' },
    { ownerIdx: 0, name: 'Bingo',   species: 'DOG',     breed: 'Nigerian Local',   gender: 'MALE',   age: 2,   weight: 18.0, color: 'Brown' },
    { ownerIdx: 1, name: 'Whiskers',species: 'CAT',     breed: 'Domestic Shorthair', gender: 'FEMALE', age: 1.5, weight: 4.2,  color: 'Grey Tabby' },
    { ownerIdx: 1, name: 'Layers Flock A', species: 'POULTRY', breed: 'ISA Brown Layer', gender: 'FEMALE', age: 1, weight: 1.8, color: 'Brown' },
    { ownerIdx: 2, name: 'Sango',   species: 'CATTLE',  breed: 'White Fulani',     gender: 'MALE',   age: 4,   weight: 320.0, color: 'White' },
    { ownerIdx: 2, name: 'Amebo',   species: 'GOAT',    breed: 'West African Dwarf', gender: 'FEMALE', age: 2, weight: 22.0, color: 'Black & White' },
    { ownerIdx: 3, name: 'Simba',   species: 'CAT',     breed: 'Persian',          gender: 'MALE',   age: 3,   weight: 5.0,  color: 'Cream' },
    { ownerIdx: 3, name: 'Bella',   species: 'DOG',     breed: 'Rottweiler',       gender: 'FEMALE', age: 4,   weight: 38.0, color: 'Black & Mahogany' },
    { ownerIdx: 4, name: 'Broiler Batch 12', species: 'POULTRY', breed: 'Cobb 500 Broiler', gender: 'UNKNOWN', age: 0.2, weight: 1.2, color: 'White' },
    { ownerIdx: 4, name: 'Tunde Ram', species: 'SHEEP', breed: 'Balami', gender: 'MALE', age: 2, weight: 45.0, color: 'White' },
  ];

  const animalIds = [];
  for (const an of animalDefs) {
    const { rows } = await query(
      `INSERT INTO animals
         (owner_id, name, species, breed, gender, age_years, weight_kg, color, vaccination_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [ownerIds[an.ownerIdx], an.name, an.species, an.breed, an.gender, an.age, an.weight, an.color, 'PARTIAL'],
    );
    animalIds.push({ id: rows[0].id, ...an });
  }
  console.log(`[seed] ✅ Animals: ${animalIds.length}`);

  // -------------------------------------------------------------------------
  // 6. CLINIC AVAILABILITY  (approved clinics: Mon-Sat weekday rows + 1 holiday)
  // -------------------------------------------------------------------------
  let availCount = 0;
  for (const c of approvedClinics) {
    for (let dow = 1; dow <= 6; dow++) {
      // Saturday (6) closes early, no break
      const isSat = dow === 6;
      await query(
        `INSERT INTO clinic_availability
           (clinic_id, day_of_week, open_time, close_time, break_start, break_end, slot_minutes)
         VALUES ($1,$2,$3,$4,$5,$6,30)`,
        [
          c.id,
          dow,
          '08:00',
          isSat ? '14:00' : '17:00',
          isSat ? null : '13:00',
          isSat ? null : '14:00',
        ],
      );
      availCount++;
    }
    // One date-specific blocked holiday (~2 weeks out)
    await query(
      `INSERT INTO clinic_availability
         (clinic_id, specific_date, is_blocked, reason)
       VALUES ($1,$2,TRUE,$3)`,
      [c.id, addDays(14), 'Public Holiday — Clinic Closed'],
    );
    availCount++;
  }
  console.log(`[seed] ✅ Clinic availability rows: ${availCount}`);

  // -------------------------------------------------------------------------
  // 7. APPOINTMENTS  (~10, varied statuses; several COMPLETED for reviews)
  // -------------------------------------------------------------------------
  const firstVet = (clinicId) => (vetIdsByClinic[clinicId]?.[0] ?? null);

  const appointmentDefs = [
    { clinicIdx: 0, ownerIdx: 0, animalIdx: 0, service: 'Anti-Rabies Vaccination', daysOffset: -21, start: '09:00', end: '09:30', status: 'COMPLETED', notes: 'Annual rabies booster administered.' },
    { clinicIdx: 3, ownerIdx: 3, animalIdx: 7, service: 'General Consultation',     daysOffset: -18, start: '10:00', end: '10:30', status: 'COMPLETED', notes: 'Routine wellness check, all normal.' },
    { clinicIdx: 1, ownerIdx: 1, animalIdx: 2, service: 'Deworming',                daysOffset: -14, start: '11:00', end: '11:30', status: 'COMPLETED', notes: 'Cat dewormed; advised 3-monthly schedule.' },
    { clinicIdx: 2, ownerIdx: 2, animalIdx: 4, service: 'FMD Vaccination',          daysOffset: -12, start: '08:30', end: '09:00', status: 'COMPLETED', notes: 'Bull vaccinated against FMD.' },
    { clinicIdx: 5, ownerIdx: 3, animalIdx: 6, service: 'Surgery — Neutering',      daysOffset: -10, start: '12:00', end: '13:00', status: 'COMPLETED', notes: 'Uneventful neutering procedure; recovered well.' },
    { clinicIdx: 4, ownerIdx: 4, animalIdx: 9, service: 'Deworming',                daysOffset: -7,  start: '09:30', end: '10:00', status: 'COMPLETED', notes: 'Ram dewormed and weighed.' },
    { clinicIdx: 0, ownerIdx: 0, animalIdx: 1, service: 'DHPP Vaccination',         daysOffset: 3,   start: '10:00', end: '10:30', status: 'CONFIRMED', notes: 'Second DHPP dose due.' },
    { clinicIdx: 1, ownerIdx: 1, animalIdx: 3, service: 'Poultry Health Visit',     daysOffset: 5,   start: '08:00', end: '09:00', status: 'CONFIRMED', notes: 'Flock health assessment.' },
    { clinicIdx: 2, ownerIdx: 2, animalIdx: 5, service: 'Consultation',             daysOffset: 7,   start: '11:30', end: '12:00', status: 'PENDING',   notes: 'Goat showing reduced appetite.' },
    { clinicIdx: 3, ownerIdx: 3, animalIdx: 7, service: 'Vaccination',              daysOffset: 9,   start: '14:00', end: '14:30', status: 'PENDING',   notes: 'Annual vaccination due.' },
    { clinicIdx: 5, ownerIdx: 4, animalIdx: 8, service: 'Poultry Health Visit',     daysOffset: -4,  start: '09:00', end: '10:00', status: 'CANCELLED', notes: 'Owner rescheduled — farm visit cancelled.' },
  ];

  const appointmentIds = [];
  for (const ap of appointmentDefs) {
    const clinic = clinicIds[ap.clinicIdx];
    const { rows } = await query(
      `INSERT INTO appointments
         (clinic_id, owner_id, animal_id, vet_id, service, scheduled_date, start_time, end_time, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        clinic.id,
        ownerIds[ap.ownerIdx],
        animalIds[ap.animalIdx].id,
        firstVet(clinic.id),
        ap.service,
        addDays(ap.daysOffset),
        ap.start,
        ap.end,
        ap.status,
        ap.notes,
      ],
    );
    appointmentIds.push({ id: rows[0].id, ...ap, clinicId: clinic.id });
  }
  console.log(`[seed] ✅ Appointments: ${appointmentIds.length}`);

  // -------------------------------------------------------------------------
  // 8. REVIEWS  (attach to COMPLETED appointments; trigger updates ratings)
  //    + 1-2 review_responses from clinic admins
  // -------------------------------------------------------------------------
  const completed = appointmentIds.filter((a) => a.status === 'COMPLETED');
  const reviewBodies = [
    { rating: 5, body: 'Excellent service. The vet was very professional and explained everything clearly. My dog is doing great after the rabies shot.' },
    { rating: 4, body: 'Good experience overall. The clinic was clean and the staff friendly. Waited a little but the care was worth it.' },
    { rating: 5, body: 'Very knowledgeable team. They handled my cat gently and gave solid advice on deworming. Highly recommend.' },
    { rating: 4, body: 'Reliable for livestock work. The FMD vaccination for my bull went smoothly and the price was fair.' },
    { rating: 5, body: 'The surgery went perfectly and follow-up advice was thorough. Grateful for the emergency support too.' },
    { rating: 3, body: 'Decent service but the clinic was quite busy. The deworming was done well, just expect to wait.' },
  ];

  const reviewIds = [];
  for (let i = 0; i < completed.length && i < reviewBodies.length; i++) {
    const ap = completed[i];
    const r = reviewBodies[i];
    const { rows } = await query(
      `INSERT INTO reviews
         (clinic_id, user_id, appointment_id, rating, body, status)
       VALUES ($1,$2,$3,$4,$5,'PUBLISHED')
       RETURNING id`,
      [ap.clinicId, ownerIds[ap.ownerIdx], ap.id, r.rating, r.body],
    );
    reviewIds.push({ id: rows[0].id, clinicIdx: ap.clinicIdx });
  }
  console.log(`[seed] ✅ Reviews: ${reviewIds.length} (ratings auto-maintained by trigger)`);

  // Review responses from the owning clinic admin
  const responseDefs = [
    { reviewIdx: 0, body: 'Thank you for the kind words! We are delighted Rex is doing well. See you at the next booster.' },
    { reviewIdx: 2, body: 'We appreciate your feedback and are glad Whiskers is in good hands. Stay on the deworming schedule!' },
  ];
  let respCount = 0;
  for (const rd of responseDefs) {
    const rev = reviewIds[rd.reviewIdx];
    if (!rev) continue;
    const clinic = clinicIds[rev.clinicIdx];
    const responderId = clinic ? adminIds[clinic.ownerIdx] : adminIds[0];
    await query(
      `INSERT INTO review_responses (review_id, responder_id, body)
       VALUES ($1,$2,$3)`,
      [rev.id, responderId, rd.body],
    );
    respCount++;
  }
  console.log(`[seed] ✅ Review responses: ${respCount}`);

  // -------------------------------------------------------------------------
  // 9. VACCINATIONS  (mix upcoming/overdue/completed; reminder = due - 7d)
  // -------------------------------------------------------------------------
  const reminderFor = (dueOffset) => addDays(dueOffset - 7);

  const vaxDefs = [
    // animalIdx, vaccine, dueOffset, status, administeredOffset(optional)
    { animalIdx: 0, vaccine: 'Anti-Rabies (Annual)',   dueOffset: -21, status: 'COMPLETED', adminOffset: -21 },
    { animalIdx: 0, vaccine: 'DHPP Booster',           dueOffset: 30,  status: 'UPCOMING' },
    { animalIdx: 1, vaccine: 'DHPP (Puppy Series)',    dueOffset: 3,   status: 'DUE' },
    { animalIdx: 1, vaccine: 'Anti-Rabies (Annual)',   dueOffset: -5,  status: 'OVERDUE' },
    { animalIdx: 3, vaccine: 'Newcastle Disease (Lasota)', dueOffset: 2, status: 'DUE' },
    { animalIdx: 4, vaccine: 'FMD Vaccine',            dueOffset: -12, status: 'COMPLETED', adminOffset: -12 },
    { animalIdx: 4, vaccine: 'FMD Booster',            dueOffset: 170, status: 'UPCOMING' },
    { animalIdx: 5, vaccine: 'PPR Vaccine',            dueOffset: -3,  status: 'OVERDUE' },
    { animalIdx: 7, vaccine: 'Anti-Rabies (Annual)',   dueOffset: 45,  status: 'UPCOMING' },
    { animalIdx: 8, vaccine: 'Newcastle Disease (Lasota)', dueOffset: 1, status: 'DUE' },
  ];

  let vaxCount = 0;
  for (const v of vaxDefs) {
    await query(
      `INSERT INTO vaccinations
         (animal_id, vaccine_name, due_date, reminder_date, administered_date, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        animalIds[v.animalIdx].id,
        v.vaccine,
        addDays(v.dueOffset),
        reminderFor(v.dueOffset),
        v.adminOffset != null ? addDays(v.adminOffset) : null,
        v.status,
        v.status === 'COMPLETED' ? 'Administered and recorded.' : 'Reminder scheduled.',
      ],
    );
    vaxCount++;
  }
  console.log(`[seed] ✅ Vaccinations: ${vaxCount}`);

  // -------------------------------------------------------------------------
  // 10. EMERGENCY REQUESTS  (2-3 varied)
  // -------------------------------------------------------------------------
  const emergencyDefs = [
    {
      ownerIdx: 0,
      assignedClinicIdx: 0,
      animal_type: 'DOG',
      symptoms: 'Dog hit by a motorcycle near Ikere roundabout, bleeding from the hind leg and unable to stand.',
      location_text: 'College Road, near Ikere roundabout, Ikerre-Ekiti',
      lat: 7.4955, lng: 5.2315,
      urgency: 'CRITICAL',
      status: 'ASSIGNED',
      resolved: null,
    },
    {
      ownerIdx: 2,
      assignedClinicIdx: null,
      animal_type: 'CATTLE',
      symptoms: 'Several cattle drooling heavily with blisters on the mouth and lameness — suspected FMD outbreak.',
      location_text: 'Igede grazing field, off Ado-Igede Road',
      lat: 7.6690, lng: 5.1350,
      urgency: 'HIGH',
      status: 'OPEN',
      resolved: null,
    },
    {
      ownerIdx: 4,
      assignedClinicIdx: 5,
      animal_type: 'POULTRY',
      symptoms: 'Sudden deaths in layer flock with greenish diarrhoea and twisted necks — possible Newcastle Disease.',
      location_text: 'Emure farm settlement, Emure-Ekiti',
      lat: 7.4350, lng: 5.4680,
      urgency: 'HIGH',
      status: 'RESOLVED',
      resolved: 'Veterinarian attended, confirmed Newcastle Disease. Affected birds isolated, flock revaccinated, biosecurity reinforced.',
    },
  ];

  let emergCount = 0;
  for (const e of emergencyDefs) {
    await query(
      `INSERT INTO emergency_requests
         (user_id, assigned_clinic_id, animal_type, symptoms, location_text, latitude, longitude, phone, urgency, status, resolved_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        ownerIds[e.ownerIdx],
        e.assignedClinicIdx != null ? clinicIds[e.assignedClinicIdx].id : null,
        e.animal_type,
        e.symptoms,
        e.location_text,
        e.lat,
        e.lng,
        owners[e.ownerIdx].phone,
        e.urgency,
        e.status,
        e.resolved,
      ],
    );
    emergCount++;
  }
  console.log(`[seed] ✅ Emergency requests: ${emergCount}`);

  // -------------------------------------------------------------------------
  // Demo credentials summary
  // -------------------------------------------------------------------------
  console.log('\n========================================================');
  console.log('  ✅ VetConnect Ekiti seed complete!');
  console.log('========================================================');
  console.log(`  Shared demo password for ALL accounts: ${DEMO_PASSWORD}\n`);
  console.log('  SUPER_ADMIN:');
  console.log('    admin@vetconnect.ng');
  console.log('\n  CLINIC_ADMIN (one per clinic):');
  for (const a of clinicAdmins) console.log(`    ${a.email}`);
  console.log('\n  OWNER:');
  for (const o of owners) console.log(`    ${o.email}`);
  console.log('========================================================\n');
}

seed()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    console.error('[seed] ❌ Failed:', err);
    await pool.end();
    process.exit(1);
  });
