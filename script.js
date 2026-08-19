// ===== State =====
let posts = [];
let currentFilter = 'all';
let searchQuery = '';
let selectedType = 'missing';
let uploadedImage = null;
let confirmCallback = null;

// ===== Storage =====
const STORAGE_KEY = 'mafqoodat_shabwa_posts_v2';

function loadPosts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) { posts = JSON.parse(data); }
    else { posts = getSamplePosts(); savePosts(); }
  } catch(e) { posts = getSamplePosts(); }
}
function savePosts() { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); }

// ===== Sample Data =====
function getSamplePosts() {
  return [
    { id: Date.now()-100000, type:'missing', title:'جوالي سامسونج أسود', description:'فقدت جوالي سامسونج لون أسود في سوق شبوة، يحتوي على صور مهمة لي. من يجده أرجو التواصل.', category:'هواتف', location:'سوق شبوة', contactName:'أحمد', contactPhone:'770123456', image:null, status:'active', date:new Date(Date.now()-3600000).toISOString() },
    { id: Date.now()-200000, type:'found', title:'محافظة جلدية بنية', description:'وجدت محافظة جلدية بنية اللون قرب مسجد السلام، بداخلها بطاقات وهوية. الرجاء التواصل لاستلامها.', category:'محافظ ونقود', location:'قرب مسجد السلام', contactName:'محمد', contactPhone:'770987654', image:null, status:'active', date:new Date(Date.now()-7200000).toISOString() },
    { id: Date.now()-300000, type:'missing', title:'بطاقة هوية شخصية', description:'فقدت بطاقة الهوية الشخصية، اسمي مذكور عليها. من يجدها يتفضل بالتواصل وشكراً.', category:'مستندات', location:'منطقة الحي', contactName:'سعيد', contactPhone:'770555123', image:null, status:'active', date:new Date(Date.now()-86400000).toISOString() },
    { id: Date.now()-400000, type:'found', title:'مفتاح سيارة', description:'وجدت مفتاح سيارة تويوتا في الشارع العام. صاحبه يمكنه التواصل لاستلامه.', category:'مفاتيح', location:'الشارع العام', contactName:'علي', contactPhone:'770456789', image:null, status:'active', date:new Date(Date.now()-172800000).toISOString() }
  ];
}

// ===== Render =====
function renderPosts() {
  const grid = document.getElementById('postsGrid');
  const empty = document.getElementById('emptyState');
  let filtered = posts.filter(p => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'missing') return p.type === 'missing' && p.status !== 'returned';
    if (currentFilter === 'found') return p.type === 'found' && p.status !== 'returned';
    if (currentFilter === 'returned') return p.status === 'returned';
    return true;
  });
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.location.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }
  filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
  document.getElementById('resultCount').textContent = filtered.length + ' إعلان';
  if (filtered.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; }
  else { empty.style.display = 'none'; grid.innerHTML = filtered.map((p,i) => renderCard(p,i)).join(''); }
  updateStats();
}

function renderCard(p, idx) {
  const typeBadge = p.type === 'missing' ? '<span class="post-type-badge badge-missing">🔴 مفقود</span>' : '<span class="post-type-badge badge-found">🟢 موجود</span>';
  let statusBadge = p.status === 'returned' ? '<span class="post-type-badge badge-claimed">✅ تم الإرجاع</span>' : '';
  const imageHtml = p.image
    ? `<div class="post-image-wrap"><img src="${p.image}" alt="${escapeHtml(p.title)}">${typeBadge}${statusBadge}</div>`
    : `<div class="post-image-wrap"><div class="post-image-placeholder">${categoryIcon(p.category)}</div>${typeBadge}${statusBadge}</div>`;
  const dateStr = formatDate(p.date);
  const actions = p.status === 'returned'
    ? `<button class="btn btn-sm btn-cancel" onclick="event.stopPropagation();deletePost(${p.id})">🗑 حذف</button>`
    : `<button class="btn btn-sm btn-success" onclick="event.stopPropagation();markReturned(${p.id})">✓ تم الإرجاع</button><button class="btn btn-sm btn-cancel" onclick="event.stopPropagation();deletePost(${p.id})">🗑</button>`;
  return `<div class="post-card" onclick="showDetail(${p.id})" style="animation-delay:${idx*0.05}s">${imageHtml}<div class="post-body"><h3>${escapeHtml(p.title)}</h3><p class="post-desc">${escapeHtml(p.description)}</p><div class="post-meta"><span class="meta-tag">${categoryIcon(p.category)} ${escapeHtml(p.category)}</span><span class="meta-tag">📍 ${escapeHtml(p.location)}</span></div><div class="post-footer"><span class="post-date">${dateStr}</span><div class="post-actions">${actions}</div></div></div></div>`;
}

function categoryIcon(cat) {
  const icons = {'هواتف':'📱','مستندات':'📄','محافظ ونقود':'💰','مجوهرات':'💎','مفاتيح':'🔑','ملابس':'👕','إلكترونيات':'💻','حيوانات':'🐾','أخرى':'📦'};
  return icons[cat] || '📦';
}
function escapeHtml(str) { const d=document.createElement('div'); d.textContent=str||''; return d.innerHTML; }
function formatDate(iso) {
  const date=new Date(iso), now=new Date(), diff=now-date;
  const min=Math.floor(diff/60000), hr=Math.floor(diff/3600000), day=Math.floor(diff/86400000);
  if(min<1) return 'الآن'; if(min<60) return `قبل ${min} دقيقة`; if(hr<24) return `قبل ${hr} ساعة`; if(day<7) return `قبل ${day} يوم`;
  return date.toLocaleDateString('ar-EG',{day:'numeric',month:'short'});
}

// ===== Stats =====
function updateStats() {
  document.getElementById('totalCount').textContent = posts.length;
  document.getElementById('missingCount').textContent = posts.filter(p=>p.type==='missing'&&p.status!=='returned').length;
  document.getElementById('foundCount').textContent = posts.filter(p=>p.type==='found'&&p.status!=='returned').length;
  document.getElementById('returnedCount').textContent = posts.filter(p=>p.status==='returned').length;
}

// ===== Search & Filter =====
function handleSearch() { searchQuery=document.getElementById('searchInput').value.trim(); renderPosts(); }
function setFilter(f) { currentFilter=f; document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); document.querySelector(`.chip[data-filter="${f}"]`).classList.add('active'); renderPosts(); }

// ===== Modal =====
function scrollToTop() { window.scrollTo({top:0,behavior:'smooth'}); }
function openAddModal() {
  document.getElementById('postForm').reset(); document.getElementById('editId').value='';
  document.getElementById('imagePreview').style.display='none'; document.getElementById('uploadText').textContent='اضغط لرفع صورة';
  document.getElementById('customCategory').style.display='none'; document.getElementById('customCategory').value='';
  uploadedImage=null; selectedType='missing'; selectType('missing');
  document.getElementById('modalTitle').textContent='إضافة إعلان جديد'; document.getElementById('addModal').classList.add('active');
}
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function selectType(type) { selectedType=type; document.querySelectorAll('.type-option').forEach(o=>o.classList.remove('selected')); document.querySelector(`.type-option[data-type="${type}"]`).classList.add('selected'); }
function handleCategoryChange() {
  const sel=document.getElementById('category'), custom=document.getElementById('customCategory');
  if(sel.value==='__custom__'){custom.style.display='block';custom.focus();}else{custom.style.display='none';custom.value='';}
}
function syncCustomCategory() { const c=document.getElementById('customCategory'); c.style.borderColor=c.value.trim()?'var(--primary)':'var(--border)'; }
function handleImageUpload(e) {
  const file=e.target.files[0]; if(!file) return;
  if(file.size>3*1024*1024){showToast('حجم الصورة كبير. الحد الأقصى 3 ميجا','error');e.target.value='';return;}
  const reader=new FileReader();
  reader.onload=function(ev){uploadedImage=ev.target.result;const p=document.getElementById('imagePreview');p.src=uploadedImage;p.style.display='block';document.getElementById('uploadText').textContent='تم اختيار الصورة ✓ (اضغط للتغيير)';};
  reader.readAsDataURL(file);
}
function submitPost(e) {
  e.preventDefault();
  const editId=document.getElementById('editId').value, title=document.getElementById('title').value.trim(), description=document.getElementById('description').value.trim();
  let category=document.getElementById('category').value;
  if(category==='__custom__'){category=document.getElementById('customCategory').value.trim();if(!category){showToast('يرجى إدخال اسم التصنيف المخصص','error');return;}}
  const location=document.getElementById('location').value.trim(), contactName=document.getElementById('contactName').value.trim(), contactPhone=document.getElementById('contactPhone').value.trim();
  if(!title||!description||!category||!location||!contactName||!contactPhone){showToast('يرجى ملء جميع الحقول المطلوبة','error');return;}
  if(editId){const post=posts.find(p=>p.id==editId);if(post){post.title=title;post.description=description;post.category=category;post.location=location;post.contactName=contactName;post.contactPhone=contactPhone;if(uploadedImage)post.image=uploadedImage;post.type=selectedType;}showToast('تم تحديث الإعلان بنجاح','success');}
  else{posts.unshift({id:Date.now(),type:selectedType,title,description,category,location,contactName,contactPhone,image:uploadedImage,status:'active',date:new Date().toISOString()});showToast('تم نشر إعلانك بنجاح','success');}
  savePosts(); renderPosts(); closeModal('addModal');
}

// ===== Detail =====
function showDetail(id) {
  const p=posts.find(x=>x.id===id); if(!p) return;
  const typeBadge=p.type==='missing'?'🔴 مفقود':'🟢 موجود', statusBadge=p.status==='returned'?' · ✅ تم الإرجاع':'';
  const phoneClean=p.contactPhone.replace(/\s/g,'');
  const imageHtml=p.image?`<div class="detail-image-wrap"><img src="${p.image}" alt="${escapeHtml(p.title)}"></div>`:`<div class="detail-image-placeholder">${categoryIcon(p.category)}</div>`;
  const actionsHtml=p.status==='returned'
    ?`<button class="btn btn-danger" style="width:100%;justify-content:center;" onclick="deletePost(${p.id})">🗑 حذف الإعلان</button>`
    :`<button class="contact-btn" onclick="contactOwner('${phoneClean}')">📞 الاتصال بصاحب الإعلان</button><div style="display:flex;gap:8px;margin-top:8px;"><button class="btn btn-success btn-sm" style="flex:1;justify-content:center;" onclick="markReturned(${p.id})">✓ تم الإرجاع</button><button class="btn btn-cancel btn-sm" style="flex:1;justify-content:center;" onclick="editPost(${p.id})">✏ تعديل</button><button class="btn btn-danger btn-sm" onclick="deletePost(${p.id})">🗑</button></div>`;
  document.getElementById('detailBody').innerHTML=`${imageHtml}<div class="detail-section"><h4>نوع الإعلان</h4><p>${typeBadge}${statusBadge}</p></div><div class="detail-section"><h4>العنوان</h4><p style="font-weight:700;font-size:1.15rem;">${escapeHtml(p.title)}</p></div><div class="detail-info-grid"><div class="info-item"><label>التصنيف</label><span>${categoryIcon(p.category)} ${escapeHtml(p.category)}</span></div><div class="info-item"><label>المكان</label><span>📍 ${escapeHtml(p.location)}</span></div><div class="info-item"><label>الاسم</label><span>${escapeHtml(p.contactName)}</span></div><div class="info-item"><label>التاريخ</label><span>${formatDate(p.date)}</span></div></div><div class="detail-section"><h4>الوصف</h4><p>${escapeHtml(p.description)}</p></div>${actionsHtml}`;
  document.getElementById('detailModal').classList.add('active');
}
function contactOwner(phone) { window.location.href=`tel:${phone}`; }

// ===== Actions =====
function editPost(id) {
  const p=posts.find(x=>x.id===id); if(!p) return; closeModal('detailModal');
  document.getElementById('editId').value=p.id; document.getElementById('modalTitle').textContent='تعديل الإعلان';
  document.getElementById('title').value=p.title; document.getElementById('description').value=p.description;
  const knownCats=['هواتف','مستندات','محافظ ونقود','مجوهرات','مفاتيح','ملابس','إلكترونيات','حيوانات'];
  const cs=document.getElementById('category'), cc=document.getElementById('customCategory');
  if(knownCats.includes(p.category)){cs.value=p.category;cc.style.display='none';cc.value='';}else{cs.value='__custom__';cc.value=p.category;cc.style.display='block';}
  document.getElementById('location').value=p.location; document.getElementById('contactName').value=p.contactName; document.getElementById('contactPhone').value=p.contactPhone;
  selectType(p.type); uploadedImage=p.image||null;
  if(p.image){const pr=document.getElementById('imagePreview');pr.src=p.image;pr.style.display='block';document.getElementById('uploadText').textContent='الصورة الحالية (اضغط للتغيير)';}else{document.getElementById('imagePreview').style.display='none';document.getElementById('uploadText').textContent='اضغط لرفع صورة';}
  document.getElementById('addModal').classList.add('active');
}
function markReturned(id) { showConfirm('✅','تم الإرجاع','هل تريد تأكيد أنه تم إرجاع هذا المفقود لمالك؟',()=>{const p=posts.find(x=>x.id===id);if(p){p.status='returned';p.returnedDate=new Date().toISOString();savePosts();renderPosts();closeModal('detailModal');showToast('تم تسجيل الإرجاع بنجاح','success');}}); }
function deletePost(id) { showConfirm('🗑','حذف الإعلان','هل أنت متأكد من حذف هذا الإعلان؟ لا يمكن التراجع.',()=>{posts=posts.filter(p=>p.id!==id);savePosts();renderPosts();closeModal('detailModal');showToast('تم حذف الإعلان','success');}); }

// ===== Confirm =====
function showConfirm(icon,title,text,callback) {
  document.getElementById('confirmIcon').textContent=icon; document.getElementById('confirmTitle').textContent=title;
  document.getElementById('confirmText').textContent=text; confirmCallback=callback;
  document.getElementById('confirmOverlay').classList.add('active');
  document.getElementById('confirmYesBtn').onclick=()=>{if(confirmCallback)confirmCallback();closeConfirm();};
}
function closeConfirm() { document.getElementById('confirmOverlay').classList.remove('active'); confirmCallback=null; }

// ===== Toast =====
function showToast(msg,type='') { const t=document.getElementById('toast'); t.textContent=msg; t.className='toast show '+type; setTimeout(()=>t.classList.remove('show'),3000); }

// ===== Init =====
loadPosts(); renderPosts();
document.querySelectorAll('.modal-overlay').forEach(o=>{o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('active');});});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.modal-overlay.active').forEach(m=>m.classList.remove('active'));closeConfirm();}});
