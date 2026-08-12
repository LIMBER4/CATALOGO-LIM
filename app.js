// Supabase Initialization
const SUPABASE_URL = 'https://khndhigxxhdkgrjqhiqr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZUtJXGlHyy9lyPLvy9b3Tg__Dqh2tMa';
const WHATSAPP_NUMBER = '59176989322';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variable global para guardar todos los productos y poder filtrarlos sin llamar a la BD de nuevo
let todosLosProductos = [];
let cmsConfig = null;

const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount);
};

// Genera un Bento Box HTML
function generarBentoCard(producto, isFeature) {
    let imageUrl = `https://images.unsplash.com/photo-1605100804763-247f66150ce8?q=80&w=1000&auto=format&fit=crop`; // Placeholder
    if (producto.imagen_url) {
        imageUrl = producto.imagen_url.startsWith('http') 
            ? producto.imagen_url 
            : `${SUPABASE_URL}/storage/v1/object/public/productos/${producto.imagen_url}`;
    }

    // Si es el feature (producto estrella), ocupa más espacio en la grilla
    const gridClass = isFeature ? "col-span-1 md:col-span-2 row-span-2" : "col-span-1 row-span-1";
    const titleClass = isFeature ? "text-3xl" : "text-xl";
    
    const desc = (producto.descripcion || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const nombre = producto.nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const videoInsta = (producto.video_instagram || '');
    const videoTiktok = (producto.video_tiktok || '');
    
    return `
        <article class="bento-card relative group cursor-pointer ${gridClass}" onclick="abrirModal('${nombre}', ${producto.precio_venta}, '${desc}', '${imageUrl}', '${videoInsta}', '${videoTiktok}')">
            <!-- Imagen de fondo -->
            <img src="${imageUrl}" alt="${producto.nombre}" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 group-hover:scale-105 transition-all duration-700">
            
            <!-- Gradiente oscuro para el texto -->
            <div class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
            
            <!-- Contenido -->
            <div class="relative h-full flex flex-col justify-end p-6 md:p-8 z-10">
                <div class="flex justify-between items-end mb-2">
                    <h2 class="${titleClass} font-black font-display tracking-wide uppercase text-white">${producto.nombre}</h2>
                </div>
                
                <p class="text-xs text-white/70 uppercase tracking-widest font-semibold mb-4">
                    ${formatMoney(producto.precio_venta)}
                </p>

                <!-- Botón de Acción -->
                <div class="overflow-hidden h-0 group-hover:h-12 transition-all duration-500 ease-in-out">
                    <button class="bg-white text-black text-[10px] uppercase font-bold tracking-[0.2em] px-6 py-3 rounded-full mt-2 hover:bg-gray-200">
                        Ver Detalles
                    </button>
                </div>
            </div>
            
            <!-- Etiqueta Material (Esquina sup derecha) -->
            <div class="absolute top-4 right-4 bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-[8px] uppercase tracking-widest text-white">
                Acero 316L
            </div>
        </article>
    `;
}

// Bloque de texto para relleno del Bento Grid
function generarBentoQuote() {
    const frase = (cmsConfig && cmsConfig.frase_bento) ? cmsConfig.frase_bento : '"Curaduría urbana. <span class="text-white">Estilo impecable.</span>"';
    return `
        <article class="bento-card col-span-1 md:col-span-2 row-span-1 bg-luxDark flex items-center justify-center p-8 text-center border-luxBorder">
            <h3 class="text-2xl md:text-3xl font-display font-bold uppercase tracking-tighter text-luxDim">
                ${frase}
            </h3>
        </article>
    `;
}

async function cargarDataInicial() {
    try {
        // Cargar Configuración CMS
        const { data: configData } = await _supabase
            .from('configuracion_web')
            .select('*')
            .limit(1)
            .single();
            
        if (configData) {
            cmsConfig = configData;
            aplicarCMS(configData);
            
            // Si está en mantenimiento, detener la carga y mostrar pantalla
            if (configData.maintenance_mode) {
                document.getElementById('maintenance-screen').classList.remove('hidden');
                document.getElementById('loader').classList.add('hidden');
                document.body.style.overflow = 'hidden';
                return; 
            }
        }

        // Cargar Productos
        const { data: productos, error } = await _supabase
            .from('productos')
            .select('*')
            .eq('activo', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        document.getElementById('loader').classList.add('hidden');
        const grid = document.getElementById('bento-grid');
        grid.classList.remove('hidden');

        if (productos.length === 0) {
            grid.innerHTML = `<p class="col-span-full text-center text-luxDim py-20">Colección vacía.</p>`;
            return;
        }

        todosLosProductos = productos;
        renderizarGrid(productos);
        generarCategoriasDinamicas();

    } catch (error) {
        console.error('Error al cargar datos:', error);
    }
}

function aplicarCMS(config) {
    // Top Banner
    const banner = document.getElementById('top-banner');
    if (config.banner_active && config.banner_text) {
        document.getElementById('banner-text').textContent = config.banner_text;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }

    // Social Links
    const instaLinks = document.querySelectorAll('.social-insta');
    instaLinks.forEach(a => a.href = config.instagram_url || '#');
    
    const tiktokLinks = document.querySelectorAll('.social-tiktok');
    tiktokLinks.forEach(a => a.href = config.tiktok_url || '#');
}

// Categorías Dinámicas
function generarCategoriasDinamicas() {
    const contenedor = document.getElementById('nav-categories');
    if (!contenedor) return;
    
    // Obtener categorías únicas, ignorando vacías
    const categorias = new Set();
    todosLosProductos.forEach(p => {
        if (p.categoria) categorias.add(p.categoria.toLowerCase());
    });
    
    let html = `<button onclick="filtrarCatalogo('Todos')" class="filter-btn bg-white text-black px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white transition-all">Todos</button>`;
    
    categorias.forEach(cat => {
        // Capitalizar primera letra
        const nombreCat = cat.charAt(0).toUpperCase() + cat.slice(1);
        html += `<button onclick="filtrarCatalogo('${cat}')" class="filter-btn bg-transparent text-luxDim hover:text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-transparent hover:border-white/20 transition-all">${nombreCat}</button>`;
    });
    
    contenedor.innerHTML = html;
}

// Función para pintar los productos en la cuadrícula
function renderizarGrid(listaProductos) {
    const grid = document.getElementById('bento-grid');
    if (listaProductos.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-center text-luxDim py-20">No hay piezas en esta categoría.</p>`;
        return;
    }

    let html = '';
    listaProductos.forEach((prod, index) => {
        // En computadora el primero es grande. En celular, todos son iguales (usamos clases Tailwind para controlar esto)
        if (index === 0 && listaProductos === todosLosProductos) {
            html += generarBentoCard(prod, true);
        } else if (index === 2 && listaProductos === todosLosProductos) {
            html += generarBentoCard(prod, false);
            html += generarBentoQuote();
        } else {
            html += generarBentoCard(prod, false);
        }
    });
    grid.innerHTML = html;
}

// Lógica de Filtros
function filtrarCatalogo(categoriaSeleccionada) {
    // Estilizar botones
    const botones = document.querySelectorAll('.filter-btn');
    botones.forEach(btn => {
        if (btn.textContent.trim() === categoriaSeleccionada) {
            btn.classList.replace('bg-transparent', 'bg-white');
            btn.classList.replace('text-luxDim', 'text-black');
            btn.classList.replace('border-luxBorder', 'border-white');
        } else {
            btn.classList.replace('bg-white', 'bg-transparent');
            btn.classList.replace('text-black', 'text-luxDim');
            btn.classList.replace('border-white', 'border-luxBorder');
        }
    });

    if (categoriaSeleccionada === 'Todos') {
        renderizarGrid(todosLosProductos);
    } else {
        const filtrados = todosLosProductos.filter(p => (p.categoria || '').toLowerCase().includes(categoriaSeleccionada.toLowerCase()));
        renderizarGrid(filtrados);
    }
}

// Lookbook Interactivo
function abrirLookbookModal() {
    // Toma el producto estrella (el primero) o uno específico para vender
    const productoEstrella = todosLosProductos[0];
    if (productoEstrella) {
        let imageUrl = `https://images.unsplash.com/photo-1605100804763-247f66150ce8?q=80&w=1000&auto=format&fit=crop`;
        if (productoEstrella.imagen_url) {
            imageUrl = productoEstrella.imagen_url.startsWith('http') 
                ? productoEstrella.imagen_url 
                : `${SUPABASE_URL}/storage/v1/object/public/productos/${productoEstrella.imagen_url}`;
        }
        const desc = (productoEstrella.descripcion || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const nombre = productoEstrella.nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const videoInsta = (productoEstrella.video_instagram || '');
        const videoTiktok = (productoEstrella.video_tiktok || '');
        abrirModal(nombre, productoEstrella.precio_venta, desc, imageUrl, videoInsta, videoTiktok);
    }
}

function comprarPorWhatsApp(nombreProducto, precio) {
    const telefono = (cmsConfig && cmsConfig.whatsapp_phone) ? cmsConfig.whatsapp_phone : WHATSAPP_NUMBER;
    const mensaje = encodeURIComponent(`¡Hola LIM! Estoy interesado en adquirir una pieza de su selección.\n\nJoya: *${nombreProducto}*\nInversión: *${formatMoney(precio)}*\n\nPor favor, indíquenme disponibilidad y métodos de envío seguro.`);
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank');
}

function abrirModal(nombre, precio, descripcion, imagen, videoInsta, videoTiktok) {
    document.getElementById('modal-img').src = imagen;
    document.getElementById('modal-title').textContent = nombre;
    document.getElementById('modal-price').textContent = formatMoney(precio);
    
    const frasePorDefecto = (cmsConfig && cmsConfig.frase_modal) ? cmsConfig.frase_modal : 'Pieza exclusiva de diseño urbano, forjada para resistir.';
    document.getElementById('modal-desc').innerHTML = descripcion || frasePorDefecto;
    
    document.getElementById('modal-buy-btn').onclick = () => comprarPorWhatsApp(nombre, precio);

    const btnInsta = document.getElementById('modal-insta-btn');
    const btnTiktok = document.getElementById('modal-tiktok-btn');
    const socialContainer = document.getElementById('modal-social-container');

    let hasMedia = false;

    if (videoInsta && videoInsta.length > 5) {
        btnInsta.classList.remove('hidden');
        btnInsta.onclick = () => window.open(videoInsta, '_blank');
        hasMedia = true;
    } else {
        btnInsta.classList.add('hidden');
    }

    if (videoTiktok && videoTiktok.length > 5) {
        btnTiktok.classList.remove('hidden');
        btnTiktok.onclick = () => window.open(videoTiktok, '_blank');
        hasMedia = true;
    } else {
        btnTiktok.classList.add('hidden');
    }

    if (hasMedia) {
        socialContainer.classList.remove('hidden');
    } else {
        socialContainer.classList.add('hidden');
    }

    const modal = document.getElementById('product-modal');
    const backdrop = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        content.classList.replace('opacity-0', 'opacity-100');
        content.classList.replace('scale-95', 'scale-100');
    }, 10);
    
    document.body.style.overflow = 'hidden';
}

function cerrarModal() {
    const backdrop = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    
    backdrop.classList.replace('opacity-100', 'opacity-0');
    content.classList.replace('opacity-100', 'opacity-0');
    content.classList.replace('scale-100', 'scale-95');
    
    setTimeout(() => {
        const modal = document.getElementById('product-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }, 300);
}

cargarDataInicial();
