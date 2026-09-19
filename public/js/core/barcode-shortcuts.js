/**
 * Detección de atajos de teclado y lector de códigos de barras (POS / Ventas)
 */
document.addEventListener('DOMContentLoaded', function() {
    let barcode = '';
    let lastTime = 0;

    function isSalesUrl() {
        const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
        return path.includes('/sales');
    }

    function isCurrentPath(target) {
        const path = window.location.pathname.replace(/\/+$/, '');
        if (target === 'sales') {
            return path.endsWith('/sales') || path.endsWith('/sales/index');
        }
        if (target === 'sales/create') {
            return path.endsWith('/sales/create') || path.includes('/sales/create');
        }
        return false;
    }

    function loadBarcodeIntoProductModal(code) {
        const modal = document.getElementById('modal-buscar_producto');
        if (!modal) return;

        // Resetear selección previa de producto al escanear un nuevo código
        const prodNombre = document.getElementById('prod_nombre');
        const prodDesc = document.getElementById('prod_descripcion');
        const prodPrecio = document.getElementById('prod_precio');
        const prodCant = document.getElementById('prod_cantidad');
        if (prodNombre) prodNombre.value = '';
        if (prodDesc) prodDesc.value = '';
        if (prodPrecio) prodPrecio.value = '';
        if (prodCant) prodCant.value = '1';

        function applyBarcodeSearch() {
            const filterContainer = document.getElementById('productTable_filter');
            const searchInput = filterContainer ? filterContainer.querySelector('input[type="search"], input') : null;

            if (searchInput) {
                searchInput.value = code;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));

                if (window.jQuery && jQuery.fn && jQuery.fn.DataTable && jQuery.fn.DataTable.isDataTable('#productTable')) {
                    try {
                        jQuery('#productTable').DataTable().search(code).draw();
                    } catch (e) {}
                }
                searchInput.focus();
                searchInput.select();
                return true;
            }
            return false;
        }

        function isModalDisplayBlock() {
            return modal.classList.contains('show') || modal.style.display === 'block' || window.getComputedStyle(modal).display === 'block';
        }

        // Si el modal ya está visible con display: block
        if (isModalDisplayBlock() && applyBarcodeSearch()) {
            return;
        }

        // Si no está abierto, abrir el modal
        if (!isModalDisplayBlock()) {
            if (window.jQuery) {
                jQuery(modal).modal('show');
            } else {
                const btnBuscar = document.querySelector('button[data-target="#modal-buscar_producto"], [data-target="#modal-buscar_producto"]');
                if (btnBuscar) {
                    btnBuscar.click();
                }
            }
        }

        // Esperar a que el modal tenga display=block y el input esté listo en productTable_filter
        let attempts = 0;
        const maxAttempts = 60; // 3 segundos máx (60 * 50ms)
        const checkInterval = setInterval(function() {
            attempts++;
            if (isModalDisplayBlock() && applyBarcodeSearch()) {
                clearInterval(checkInterval);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
            }
        }, 50);

        if (window.jQuery) {
            jQuery(modal).one('shown.bs.modal', function() {
                setTimeout(applyBarcodeSearch, 50);
            });
        }
    }

    // Limpieza de campos al cerrar el modal de búsqueda de producto
    if (window.jQuery) {
        jQuery(document).on('hidden.bs.modal', '#modal-buscar_producto', function() {
            const prodNombre = document.getElementById('prod_nombre');
            const prodDesc = document.getElementById('prod_descripcion');
            const prodPrecio = document.getElementById('prod_precio');
            const prodCant = document.getElementById('prod_cantidad');
            if (prodNombre) prodNombre.value = '';
            if (prodDesc) prodDesc.value = '';
            if (prodPrecio) prodPrecio.value = '';
            if (prodCant) prodCant.value = '1';
        });

        // Al tipear una nueva búsqueda en el filtro, reiniciar la selección previa
        jQuery(document).on('input', '#productTable_filter input', function() {
            const prodNombre = document.getElementById('prod_nombre');
            if (prodNombre && prodNombre.value !== '') {
                prodNombre.value = '';
                const prodDesc = document.getElementById('prod_descripcion');
                const prodPrecio = document.getElementById('prod_precio');
                const prodCant = document.getElementById('prod_cantidad');
                if (prodDesc) prodDesc.value = '';
                if (prodPrecio) prodPrecio.value = '';
                if (prodCant) prodCant.value = '1';
            }
        });
    }

    document.addEventListener('keydown', function(event) {
        const currentTime = new Date().getTime();

        // 1) En vista /sales: Ctrl + N redirige al botón de nueva venta (sales/create)
        if (event.ctrlKey && event.key && event.key.toLowerCase() === 'n') {
            if (isCurrentPath('sales')) {
                event.preventDefault(); // Evita abrir nueva ventana del navegador
                const linkCreate = document.querySelector('a[href*="sales/create"]');
                if (linkCreate) {
                    linkCreate.click();
                }
                return;
            }
        }

        // Si pasa más de 100ms entre teclas, es escritura manual y reiniciamos el acumulador
        if (currentTime - lastTime > 100) {
            barcode = '';
        }
        lastTime = currentTime;

        // Detección de tecla Enter
        if (event.key === 'Enter') {
            if (barcode.length > 3) {
                // Entrada detectada desde el lector de código de barras
                const scannedCode = barcode;
                barcode = '';

                // En cualquier URL de ventas (/sales/create): abrir modal de búsqueda y cargar código en el filtro
                if (isSalesUrl()) {
                    event.preventDefault();
                    loadBarcodeIntoProductModal(scannedCode);
                }
            } else {
                // Pulsación de tecla Enter manual
                barcode = '';

                if (!isSalesUrl()) {
                    return;
                }

                // Si hay una alerta SweetAlert2 abierta, dejar que SweetAlert2 gestione su Enter
                if (document.querySelector('.swal2-container') || (window.Swal && typeof Swal.isVisible === 'function' && Swal.isVisible())) {
                    return;
                }

                // A) Si el modal de búsqueda de producto está abierto
                const modalProd = document.getElementById('modal-buscar_producto');
                const isProdModalOpen = modalProd && (
                    modalProd.classList.contains('show') ||
                    modalProd.style.display === 'block' ||
                    window.getComputedStyle(modalProd).display === 'block'
                );

                if (isProdModalOpen) {
                    event.preventDefault();

                    const searchInput = modalProd.querySelector('#productTable_filter input');
                    const isFocusOnSearch = searchInput && document.activeElement === searchInput;
                    const prodNombre = document.getElementById('prod_nombre');
                    const hasSelectedProduct = prodNombre && prodNombre.value.trim() !== '';

                    // 1er Enter: Si está enfocado en la búsqueda o aún no ha seleccionado producto,
                    // hace click en el botón de clase "btn-seleccionar"
                    if (isFocusOnSearch || !hasSelectedProduct) {
                        let btnSeleccionar = null;
                        if (window.jQuery) {
                            btnSeleccionar = jQuery(modalProd).find('#productTable tbody .btn-seleccionar:visible').first()[0];
                        }
                        if (!btnSeleccionar) {
                            btnSeleccionar = modalProd.querySelector('#productTable tbody .btn-seleccionar');
                        }

                        if (btnSeleccionar) {
                            btnSeleccionar.click();
                            // Seleccionar el campo de cantidad para facilitar cambio rápido de cantidad
                            const prodCant = document.getElementById('prod_cantidad');
                            if (prodCant) {
                                setTimeout(function() {
                                    prodCant.focus();
                                    prodCant.select();
                                }, 20);
                            }
                        }
                    } else {
                        // 2do Enter: Hace click en el botón con id "btn_agregar_carrito"
                        const btnAgregar = document.getElementById('btn_agregar_carrito');
                        if (btnAgregar) {
                            btnAgregar.click();
                        }
                    }
                    return;
                }

                // Si hay cualquier otro modal abierto (ej. cliente, nuevo cliente), no accionar el wizard de fondo
                const anyOtherModal = document.querySelector('.modal.show, .modal[style*="display: block"]');
                if (anyOtherModal) {
                    return;
                }

                // B) Wizard de ventas: Enter presiona el botón correspondiente según el paso activo
                const paneCliente = document.getElementById('pane-cliente');
                const paneCarrito = document.getElementById('pane-carrito');
                const panePago = document.getElementById('pane-pago');

                // Paso 1 (Cliente): Enter presiona 'btn-sig-cliente'
                if (paneCliente && (paneCliente.classList.contains('active') || paneCliente.classList.contains('show'))) {
                    const btnSigCliente = document.getElementById('btn-sig-cliente');
                    if (btnSigCliente) {
                        event.preventDefault();
                        btnSigCliente.click();
                        return;
                    }
                }
                // Paso 2 (Carrito): Enter presiona 'btn-sig-carrito'
                else if (paneCarrito && (paneCarrito.classList.contains('active') || paneCarrito.classList.contains('show'))) {
                    const btnSigCarrito = document.getElementById('btn-sig-carrito');
                    if (btnSigCarrito) {
                        event.preventDefault();
                        btnSigCarrito.click();
                        return;
                    }
                }
                // Paso 3 (Pago): Enter presiona 'btn_guardar_venta'
                else if (panePago && (panePago.classList.contains('active') || panePago.classList.contains('show'))) {
                    const btnGuardarVenta = document.getElementById('btn_guardar_venta');
                    if (btnGuardarVenta) {
                        event.preventDefault();
                        btnGuardarVenta.click();
                        return;
                    }
                }
                // Fallback genérico para cualquier pestaña activa con botón siguiente
                else {
                    const activePane = document.querySelector('.tab-pane.active');
                    if (activePane) {
                        const nextBtn = activePane.querySelector('button[id^="btn-sig"], .btn-siguiente');
                        if (nextBtn) {
                            event.preventDefault();
                            nextBtn.click();
                            return;
                        }
                    }
                }
            }
            barcode = '';
        } else if (event.key && event.key.length === 1) {
            barcode += event.key;
        }
    });
});
