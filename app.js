/* =========================================================
   RecipeHub — add, view, edit, delete & search recipes
   Data is saved in the browser (localStorage).
   ========================================================= */

const STORAGE_KEY = 'recipehub_recipes';
const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const EMOJI = { Breakfast: '🥞', Lunch: '🥗', Dinner: '🍝', Snacks: '🍪' };

const app = document.getElementById('app');
let activeCategory = 'All';
let searchTerm = '';

/* ---------- Sample data (loaded on first visit) ---------- */
const SAMPLE_RECIPES = [
  {
    name: 'Fluffy Banana Pancakes', category: 'Breakfast', time: '20 min', image: '',
    ingredients: ['1 ripe banana', '1 cup all-purpose flour', '1 egg', '3/4 cup milk', '1 tbsp sugar', '1 tsp baking powder', 'Pinch of salt', 'Butter for the pan'],
    instructions: ['Mash the banana in a bowl until smooth.', 'Whisk in the egg, milk and sugar.', 'Fold in the flour, baking powder and salt until just combined.', 'Heat a buttered pan on medium and pour 1/4 cup batter per pancake.', 'Cook until bubbles form, flip and cook 1 more minute. Serve with honey.']
  },
  {
    name: 'Chicken Biryani', category: 'Lunch', time: '1 hr', image: '',
    ingredients: ['500 g chicken', '2 cups basmati rice', '2 onions, sliced', '1 cup yogurt', '2 tbsp biryani masala', '1 tbsp ginger-garlic paste', 'Mint & coriander leaves', '3 tbsp ghee', 'Salt to taste'],
    instructions: ['Marinate chicken with yogurt, masala, ginger-garlic paste and salt for 30 minutes.', 'Fry onions in ghee until golden; set half aside.', 'Cook the marinated chicken with the remaining onions until tender.', 'Par-boil the rice with salt until 70% cooked, then drain.', 'Layer rice over chicken, top with fried onions and herbs, cover and cook on low (dum) for 20 minutes.']
  },
  {
    name: 'Creamy Garlic Pasta', category: 'Dinner', time: '25 min', image: '',
    ingredients: ['200 g spaghetti', '4 garlic cloves, minced', '1 cup cream', '1/2 cup grated parmesan', '2 tbsp butter', 'Black pepper', 'Fresh parsley'],
    instructions: ['Boil pasta in salted water until al dente; keep 1/2 cup pasta water.', 'Melt butter and sauté garlic for 1 minute.', 'Add cream and simmer for 3 minutes.', 'Stir in parmesan, pepper and the pasta.', 'Loosen with pasta water if needed and garnish with parsley.']
  },
  {
    name: 'Masala Peanuts', category: 'Snacks', time: '15 min', image: '',
    ingredients: ['1 cup raw peanuts', '3 tbsp gram flour', '1 tbsp rice flour', '1 tsp chilli powder', '1/4 tsp turmeric', 'Salt to taste', 'Oil for frying'],
    instructions: ['Mix flours, spices and salt with peanuts.', 'Sprinkle a little water so the coating sticks.', 'Deep fry in hot oil until crisp and golden.', 'Drain on paper and cool before serving.']
  }
];

/* ---------- Storage helpers ---------- */
function getRecipes() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data === null) {
    const seeded = SAMPLE_RECIPES.map((r, i) => ({ ...r, id: makeId(), createdAt: Date.now() - i * 1000 }));
    saveRecipes(seeded);
    return seeded;
  }
  try { return JSON.parse(data); } catch { return []; }
}
function saveRecipes(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    toast('Storage full — try a smaller image');
    return false;
  }
}
function getRecipe(id) { return getRecipes().find(r => r.id === id); }
function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- Small utilities ---------- */
function escapeHTML(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toLines(text) { return text.split('\n').map(l => l.trim()).filter(Boolean); }
function imageHTML(r) {
  return r.image
    ? `<img src="${escapeHTML(r.image)}" alt="${escapeHTML(r.name)}" loading="lazy">`
    : `<div class="placeholder ph-${r.category}">${EMOJI[r.category] || '🍽️'}</div>`;
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* Resize uploaded photo so it fits in localStorage */
function resizeImage(file, maxW = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   VIEWS
   ========================================================= */

/* ---------- 1. Home: all recipes + search + categories ---------- */
function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <h1>Cook something <em>delicious</em> today</h1>
      <p>Your personal recipe collection — save, browse and share your favourite dishes.</p>
      <div class="search">
        <input id="search" type="search" placeholder="Search recipes by name…" value="${escapeHTML(searchTerm)}" autocomplete="off">
      </div>
    </section>
    <div class="chips">
      ${['All', ...CATEGORIES].map(c => `
        <button class="chip ${c === activeCategory ? 'active' : ''}" data-cat="${c}">
          ${c === 'All' ? '🍽️' : EMOJI[c]} ${c}
        </button>`).join('')}
    </div>
    <section id="grid" class="grid"></section>
  `;

  const searchInput = document.getElementById('search');
  searchInput.addEventListener('input', e => { searchTerm = e.target.value; renderGrid(); });

  document.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
    activeCategory = btn.dataset.cat;
    document.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b === btn));
    renderGrid();
  }));

  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const term = searchTerm.trim().toLowerCase();
  const list = getRecipes()
    .filter(r => activeCategory === 'All' || r.category === activeCategory)
    .filter(r => r.name.toLowerCase().includes(term))
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div>🥄</div>
        <p>No recipes found${term ? ` for “${escapeHTML(searchTerm)}”` : ''}.</p>
        <br><a href="#/add" class="btn btn-primary">+ Add a recipe</a>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(r => `
    <a class="card" href="#/recipe/${r.id}">
      <div class="card-img">${imageHTML(r)}</div>
      <div class="card-body">
        <span class="badge badge-${r.category}">${r.category}</span>
        <h3>${escapeHTML(r.name)}</h3>
        <p>${r.ingredients.length} ingredients${r.time ? ' · ⏱ ' + escapeHTML(r.time) : ''}</p>
      </div>
    </a>`).join('');
}

/* ---------- 3. View recipe ---------- */
function renderDetail(id) {
  const r = getRecipe(id);
  if (!r) return renderNotFound();

  app.innerHTML = `
    <a href="#/" class="back">← Back to recipes</a>
    <article class="detail">
      <div class="detail-img">${imageHTML(r)}</div>
      <div class="detail-content">
        <div class="detail-head">
          <div>
            <span class="badge badge-${r.category}">${r.category}</span>
            <h1>${escapeHTML(r.name)}</h1>
            ${r.time ? `<p style="color:var(--muted);margin-top:6px">⏱ ${escapeHTML(r.time)}</p>` : ''}
          </div>
          <div class="actions">
            <a href="#/edit/${r.id}" class="btn btn-ghost">✏️ Edit</a>
            <button class="btn btn-danger" id="delete-btn">🗑 Delete</button>
          </div>
        </div>
        <div class="detail-cols">
          <section>
            <h2>Ingredients</h2>
            <ul class="ingredients">${r.ingredients.map(i => `<li>${escapeHTML(i)}</li>`).join('')}</ul>
          </section>
          <section>
            <h2>Instructions</h2>
            <ol class="steps">${r.instructions.map(s => `<li>${escapeHTML(s)}</li>`).join('')}</ol>
          </section>
        </div>
      </div>
    </article>
  `;
  document.getElementById('delete-btn').addEventListener('click', () => confirmDelete(r));
}

/* ---------- 2 & 4. Add / Edit recipe form ---------- */
function renderForm(id) {
  const editing = Boolean(id);
  const r = editing ? getRecipe(id) : null;
  if (editing && !r) return renderNotFound();

  let imageData = r ? r.image : '';

  app.innerHTML = `
    <a href="${editing ? '#/recipe/' + id : '#/'}" class="back">← Back</a>
    <div class="form-wrap">
      <h1>${editing ? 'Edit recipe' : 'Add a new recipe'}</h1>
      <p class="sub">${editing ? 'Update the details below and save.' : 'Share a dish you love.'}</p>
      <form class="form" id="recipe-form" novalidate>
        <div class="field">
          <label for="name">Recipe name</label>
          <input id="name" maxlength="80" placeholder="e.g. Chicken Biryani" value="${escapeHTML(r?.name || '')}">
          <div class="error" id="err-name"></div>
        </div>

        <div class="row">
          <div class="field">
            <label for="category">Category</label>
            <select id="category">
              ${CATEGORIES.map(c => `<option ${r?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="time">Cooking time <small>(optional)</small></label>
            <input id="time" maxlength="20" placeholder="e.g. 30 min" value="${escapeHTML(r?.time || '')}">
          </div>
        </div>

        <div class="field">
          <label>Food image</label>
          <label class="upload" for="image">
            📷 Click to upload a photo <small>(JPG/PNG)</small>
            <input type="file" id="image" accept="image/*">
          </label>
          <div style="margin-top:10px">
            <input id="image-url" placeholder="…or paste an image URL" value="${r?.image && !r.image.startsWith('data:') ? escapeHTML(r.image) : ''}">
          </div>
          <div class="preview" id="preview">${imageData ? `<img src="${escapeHTML(imageData)}" alt="preview">` : ''}</div>
        </div>

        <div class="field">
          <label for="ingredients">Ingredients <small>— one per line</small></label>
          <textarea id="ingredients" placeholder="2 cups rice&#10;1 onion, sliced&#10;Salt to taste">${escapeHTML(r ? r.ingredients.join('\n') : '')}</textarea>
          <div class="error" id="err-ingredients"></div>
        </div>

        <div class="field">
          <label for="instructions">Cooking instructions <small>— one step per line</small></label>
          <textarea id="instructions" placeholder="Wash the rice&#10;Fry the onions until golden&#10;…">${escapeHTML(r ? r.instructions.join('\n') : '')}</textarea>
          <div class="error" id="err-instructions"></div>
        </div>

        <div class="form-actions">
          <a href="${editing ? '#/recipe/' + id : '#/'}" class="btn btn-ghost">Cancel</a>
          <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add recipe'}</button>
        </div>
      </form>
    </div>
  `;

  const preview = document.getElementById('preview');
  const showPreview = src => { preview.innerHTML = src ? `<img src="${escapeHTML(src)}" alt="preview">` : ''; };

  document.getElementById('image').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      imageData = await resizeImage(file);
      document.getElementById('image-url').value = '';
      showPreview(imageData);
    } catch { toast('Could not read that image'); }
  });

  document.getElementById('image-url').addEventListener('input', e => {
    imageData = e.target.value.trim();
    showPreview(imageData);
  });

  document.getElementById('recipe-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const ingredients = toLines(document.getElementById('ingredients').value);
    const instructions = toLines(document.getElementById('instructions').value);

    const errors = {
      name: name ? '' : 'Please enter a recipe name.',
      ingredients: ingredients.length ? '' : 'Add at least one ingredient.',
      instructions: instructions.length ? '' : 'Add at least one step.'
    };
    Object.entries(errors).forEach(([k, v]) => document.getElementById('err-' + k).textContent = v);
    if (Object.values(errors).some(Boolean)) return;

    const data = {
      name,
      category: document.getElementById('category').value,
      time: document.getElementById('time').value.trim(),
      image: imageData,
      ingredients,
      instructions
    };

    const list = getRecipes();
    let targetId = id;
    if (editing) {
      const idx = list.findIndex(x => x.id === id);
      list[idx] = { ...list[idx], ...data, updatedAt: Date.now() };
    } else {
      targetId = makeId();
      list.push({ ...data, id: targetId, createdAt: Date.now() });
    }
    if (!saveRecipes(list)) return;

    toast(editing ? 'Recipe updated ✓' : 'Recipe added ✓');
    location.hash = '#/recipe/' + targetId;
  });
}

/* ---------- 5. Delete recipe ---------- */
function confirmDelete(r) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-text').textContent = `“${r.name}” will be removed permanently.`;
  modal.classList.remove('hidden');

  const close = () => modal.classList.add('hidden');
  document.getElementById('modal-cancel').onclick = close;
  modal.onclick = e => { if (e.target === modal) close(); };
  document.getElementById('modal-confirm').onclick = () => {
    saveRecipes(getRecipes().filter(x => x.id !== r.id));
    close();
    toast('Recipe deleted');
    location.hash = '#/';
  };
}

function renderNotFound() {
  app.innerHTML = `
    <div class="empty">
      <div>🍳</div>
      <p>That recipe doesn't exist.</p><br>
      <a href="#/" class="btn btn-primary">Go home</a>
    </div>`;
}

/* =========================================================
   ROUTER  (#/, #/add, #/recipe/:id, #/edit/:id)
   ========================================================= */
function router() {
  const [, page, id] = (location.hash || '#/').split('/');
  window.scrollTo(0, 0);
  if (page === 'add') renderForm();
  else if (page === 'edit' && id) renderForm(id);
  else if (page === 'recipe' && id) renderDetail(id);
  else renderHome();
}

window.addEventListener('hashchange', router);
router();
