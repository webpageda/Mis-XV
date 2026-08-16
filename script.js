const archivosInput = document.getElementById("archivos");
const nombreArchivos = document.getElementById("nombre-archivos");
const btnSubir = document.getElementById("btn-subir");

// URL DE GOOGLE APPS SCRIPT

const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbzlQ-41KXv-IXFPoT1PT-tLz38onx5es51ttqUWGo3PjmxBACPy9TKVxdMpmH0rbuur/exec";

archivosInput.addEventListener("change", function () {

    const archivos = archivosInput.files;

    if (archivos.length === 0) {

        nombreArchivos.textContent =
            "No has seleccionado ningún archivo.";
        return;

    }

    let fotos = 0;
    let videos = 0;
    let tamañoTotal = 0;


    for (let archivo of archivos) {

        tamañoTotal += archivo.size;

        if (archivo.type.startsWith("image/")) {
            fotos++;
        }

        if (archivo.type.startsWith("video/")) {
            videos++;
        }

    }

    const tamañoMB =
        (tamañoTotal / (1024 * 1024)).toFixed(2);

    let mensaje = "";

    if (fotos > 0) {

        mensaje +=
            `📸 ${fotos} foto${fotos !== 1 ? "s" : ""}`;

    }

    if (videos > 0) {

        if (mensaje !== "") {
            mensaje += " • ";
        }

        mensaje +=
            `🎥 ${videos} vídeo${videos !== 1 ? "s" : ""}`;

    }

    mensaje +=
        `<br>📦 Tamaño total: ${tamañoMB} MB`;


    nombreArchivos.innerHTML = mensaje;

});


// ================================
// SUBIR ARCHIVOS
// ================================

btnSubir.addEventListener("click", async function () {

    const archivos = archivosInput.files;

    if (archivos.length === 0) {

        alert("📸 Primero selecciona alguna foto o vídeo.");

        return;
    }

    btnSubir.disabled = true;

    btnSubir.textContent = "⏳ Subiendo...";

    try {

        for (let archivo of archivos) {
            await subirArchivo(archivo);
        }

        alert(
            "💕 ¡Tus recuerdos se han enviado correctamente!"
        );

        archivosInput.value = "";

        nombreArchivos.textContent =
            "No has seleccionado ningún archivo.";

    } catch (error) {

        console.error(error);

        alert(
            "❌ Ocurrió un problema al subir los archivos."
        );

    }

    btnSubir.disabled = false;

    btnSubir.textContent =
        "💕 Compartir recuerdos";

});

// ================================
// FUNCIÓN PARA SUBIR UN ARCHIVO
// ================================

function subirArchivo(archivo) {

    return new Promise((resolve, reject) => {

        const lector = new FileReader();

        lector.onload = async function () {

            try {
                // Obtener solamente la parte Base64
                const base64 =
                    lector.result.split(",")[1];

                const datos = {
                    nombre: archivo.name,
                    tipo: archivo.type,
                    contenido: base64
                };

                const formulario =
                    new URLSearchParams();

                formulario.append(
                    "datos",
                    JSON.stringify(datos)
                );

                await fetch(URL_APPS_SCRIPT, {
                    method: "POST",
                    mode: "no-cors",
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },

                    body: formulario

                });

                resolve();

            } catch (error) {
                reject(error);
            }

        };


        lector.onerror = function () {

            reject(
                new Error(
                    "No se pudo leer el archivo."
                )
            );

        };

        lector.readAsDataURL(archivo);

    });

}