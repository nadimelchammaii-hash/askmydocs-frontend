<script setup lang="ts">
  import type { PdfTarget } from '@/utils/citations'
  /**
 * Shows one page of the document with pdf.js and highlights cited quotes on it.
 * Stitch: right pane of "Document Chat & Split PDF Viewer" and "PDF Citation Viewer".
 *
 * The PDF is untrusted: it is rendered to a canvas plus an invisible text layer
 * (for highlighting and selection). No annotation layer (links, forms) and no
 * scripting are enabled.
 */
  import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist'
  import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
  import { documentsApi } from '@/api/documents'
  import { toApiError } from '@/api/errors'
  import { findQuote } from '@/utils/quoteMatch'

  const props = defineProps<{ documentId: string, target: PdfTarget | null }>()
  const emit = defineEmits<{ 'close-target': [] }>()

  const MIN_ZOOM = 0.5
  const MAX_ZOOM = 3

  const viewport = useTemplateRef<HTMLDivElement>('viewport')
  const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
  const textLayerElement = useTemplateRef<HTMLDivElement>('textLayer')

  const loading = ref(true)
  const error = ref<string | null>(null)
  const pageCount = ref(0)
  const pageNumber = ref(props.target?.page ?? 1)
  const pageInput = ref(String(pageNumber.value))
  /** Multiplies the fit-to-width scale. */
  const zoom = ref(1)
  const width = ref(0)
  const scale = ref(1)
  /** Set when a quote of the target could not be located in the page text. */
  const quoteNotFound = ref(false)

  const pdf = shallowRef<PDFDocumentProxy | null>(null)
  let loadingTask: PDFDocumentLoadingTask | undefined
  let renderTask: RenderTask | undefined
  let textLayer: TextLayer | undefined
  let renderRun = 0
  let resizeObserver: ResizeObserver | undefined

  const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)

  async function load () {
    loading.value = true
    error.value = null
    try {
      const [pdfjs, blob] = await Promise.all([loadPdfJs(), documentsApi.file(props.documentId)])
      loadingTask = pdfjs.getDocument({
        data: new Uint8Array(await blob.arrayBuffer()),
        enableXfa: false,
      })
      pdf.value = await loadingTask.promise
      pageCount.value = pdf.value.numPages
      pageNumber.value = Math.min(Math.max(pageNumber.value, 1), pageCount.value)
      loading.value = false
      await render()
    } catch (error_) {
      loading.value = false
      // API problems (e.g. network) have a message for the user; pdf.js errors do not.
      const apiError = toApiError(error_)
      error.value = apiError.code === 'unknown_error' ? 'This PDF could not be displayed.' : apiError.message
    }
  }

  /** pdf.js is large: it is only downloaded when a PDF is opened. */
  async function loadPdfJs () {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  }

  async function render () {
    const document = pdf.value
    if (!document || !canvas.value || !textLayerElement.value || width.value === 0) {
      return
    }
    const run = ++renderRun
    renderTask?.cancel()
    textLayer?.cancel()

    try {
      const { TextLayer } = await import('pdfjs-dist')
      const page = await document.getPage(pageNumber.value)
      if (run !== renderRun) {
        return
      }
      const unscaled = page.getViewport({ scale: 1 })
      scale.value = Math.max(0.1, (width.value / unscaled.width) * zoom.value)
      const pageViewport = page.getViewport({ scale: scale.value })

      // Sharp on high-density screens.
      const ratio = window.devicePixelRatio || 1
      const target = canvas.value
      target.width = Math.floor(pageViewport.width * ratio)
      target.height = Math.floor(pageViewport.height * ratio)
      target.style.width = `${Math.floor(pageViewport.width)}px`
      target.style.height = `${Math.floor(pageViewport.height)}px`
      renderTask = page.render({
        canvas: target,
        viewport: pageViewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      })
      await renderTask.promise

      textLayerElement.value.replaceChildren()
      textLayer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: textLayerElement.value,
        viewport: pageViewport,
      })
      await textLayer.render()
      if (run === renderRun) {
        highlight()
      }
    } catch (error_) {
      if (!(error_ instanceof Error && error_.name === 'RenderingCancelledException')) {
        error.value = 'This page could not be displayed.'
      }
    }
  }

  function highlight () {
    quoteNotFound.value = false
    if (!textLayer || props.target?.page !== pageNumber.value) {
      return
    }
    const pieces = textLayer.textContentItemsStr
    const divs = textLayer.textDivs
    let first: HTMLElement | undefined
    for (const quote of props.target.quotes) {
      const indexes = findQuote(pieces, quote)
      if (indexes.length === 0) {
        quoteNotFound.value = true
      }
      for (const index of indexes) {
        divs[index]?.classList.add('is-cited')
        first ??= divs[index]
      }
    }
    first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function goTo (page: number) {
    if (pageCount.value === 0) {
      return
    }
    pageNumber.value = Math.min(Math.max(Math.round(page), 1), pageCount.value)
    pageInput.value = String(pageNumber.value)
  }

  function onPageInput () {
    const page = Number(pageInput.value)
    if (Number.isFinite(page)) {
      goTo(page)
    } else {
      pageInput.value = String(pageNumber.value)
    }
  }

  function setZoom (value: number) {
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
  }

  watch(() => props.target, target => {
    if (target) {
      if (target.page === pageNumber.value) {
        void render()
      } else {
        goTo(target.page)
      }
    } else {
      // Remove the highlight.
      for (const element of textLayerElement.value?.querySelectorAll('.is-cited') ?? []) {
        element.classList.remove('is-cited')
      }
      quoteNotFound.value = false
    }
  })

  watch([pageNumber, zoom], () => {
    pageInput.value = String(pageNumber.value)
    void render()
  })

  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  watch(width, (current, previous) => {
    clearTimeout(resizeTimer)
    // Render at once the first time, then wait until resizing settles.
    resizeTimer = setTimeout(() => void render(), previous === 0 ? 0 : 150)
  })

  onMounted(() => {
    if (viewport.value) {
      resizeObserver = new ResizeObserver(entries => {
        const box = entries[0]?.contentRect
        // Leave room for the page's padding.
        width.value = Math.max(0, Math.floor((box?.width ?? 0) - 32))
      })
      resizeObserver.observe(viewport.value)
    }
    void load()
  })

  onBeforeUnmount(() => {
    renderRun++
    clearTimeout(resizeTimer)
    resizeObserver?.disconnect()
    renderTask?.cancel()
    textLayer?.cancel()
    void loadingTask?.destroy()
  })
</script>

<template>
  <div class="pdf-viewer d-flex flex-column h-100 bg-surface-container">
    <!-- Toolbar -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-2 px-3 py-2 bg-surface-container-lowest shadow-sm">
      <div class="d-flex align-center ga-1">
        <v-btn
          aria-label="Previous page"
          :disabled="pageNumber <= 1 || loading"
          icon="chevron_left"
          size="small"
          variant="text"
          @click="goTo(pageNumber - 1)"
        />

        <div class="d-flex align-center ga-1 px-2 py-1 rounded bg-surface-container-low text-label-code">
          <input
            v-model="pageInput"
            aria-label="Page number"
            class="page-input text-on-surface font-weight-bold"
            :disabled="loading"
            inputmode="numeric"
            @blur="onPageInput"
            @keydown.enter="onPageInput"
          >

          <span class="text-on-surface-variant">/ {{ pageCount || '–' }}</span>
        </div>

        <v-btn
          aria-label="Next page"
          :disabled="pageNumber >= pageCount || loading"
          icon="chevron_right"
          size="small"
          variant="text"
          @click="goTo(pageNumber + 1)"
        />
      </div>

      <div class="d-flex align-center ga-1">
        <v-btn
          aria-label="Zoom out"
          :disabled="zoom <= MIN_ZOOM || loading"
          icon="zoom_out"
          size="small"
          variant="text"
          @click="setZoom(zoom / 1.25)"
        />

        <span aria-live="polite" class="text-label-code text-on-surface zoom-label">{{ zoomLabel }}</span>

        <v-btn
          aria-label="Zoom in"
          :disabled="zoom >= MAX_ZOOM || loading"
          icon="zoom_in"
          size="small"
          variant="text"
          @click="setZoom(zoom * 1.25)"
        />

        <v-btn
          aria-label="Fit to width"
          :disabled="zoom === 1 || loading"
          icon="fit_screen"
          size="small"
          variant="text"
          @click="setZoom(1)"
        />
      </div>
    </div>

    <!-- Cited passage -->
    <div v-if="target" class="citation-banner bg-primary text-on-primary px-4 py-2 d-flex align-start ga-3">
      <v-icon class="mt-1" icon="format_quote" size="18" />

      <div class="d-flex flex-column flex-grow-1 min-w-0 ga-1">
        <span class="text-label-code text-uppercase font-weight-bold">Source [{{ target.number }}] · page {{ target.page }}</span>
        <q v-for="quote in target.quotes" :key="quote" class="text-body-sm quote">{{ quote }}</q>
        <span v-if="quoteNotFound" class="text-body-sm opacity-80">The exact passage could not be marked on the page; it is shown here.</span>
      </div>

      <v-btn
        aria-label="Close source"
        icon="close"
        size="x-small"
        variant="text"
        @click="emit('close-target')"
      />
    </div>

    <!-- Page -->
    <div ref="viewport" class="viewport flex-grow-1 pa-4">
      <div v-if="loading" class="d-flex flex-column align-center justify-center h-100 ga-2 text-on-surface-variant">
        <v-progress-circular aria-label="Loading PDF" color="primary" indeterminate />
        <span class="text-body-sm">Loading PDF…</span>
      </div>

      <v-alert
        v-else-if="error"
        color="error"
        icon="error"
        role="alert"
        rounded="lg"
        :text="error"
        variant="tonal"
      />

      <div
        v-show="!loading && !error"
        class="page mx-auto"
        :style="{ '--total-scale-factor': String(scale), '--scale-round-x': '1px', '--scale-round-y': '1px' }"
      >
        <canvas ref="canvas" aria-label="PDF page" role="img" />
        <div ref="textLayer" class="textLayer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewport {
  overflow: auto;
  min-height: 0;
}

.page {
  position: relative;
  width: fit-content;
  box-shadow: var(--shadow-soft);
  background: white;
}

.page canvas {
  display: block;
}

.page-input {
  width: 3ch;
  text-align: center;
  background: transparent;
  outline: none;
}

.zoom-label {
  min-width: 42px;
  text-align: center;
}

.quote {
  quotes: '“' '”';
  font-style: italic;
}

.min-w-0 {
  min-width: 0;
}

/* pdf.js text layer (from pdfjs-dist/web/pdf_viewer.css, reduced to what is used). */
.textLayer {
  position: absolute;
  inset: 0;
  overflow: clip;
  line-height: 1;
  text-align: initial;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  z-index: 0;
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}

.textLayer :deep(span),
.textLayer :deep(br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
}

.textLayer :deep(> :not(.markedContent)),
.textLayer :deep(.markedContent span:not(.markedContent)) {
  z-index: 1;
  --font-height: 0;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  --scale-x: 1;
  --rotate: 0deg;
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}

.textLayer :deep(.markedContent) {
  display: contents;
}

.textLayer :deep(::selection) {
  background: rgba(var(--v-theme-primary), 0.25);
}

.textLayer :deep(.is-cited) {
  background: rgba(var(--v-theme-secondary-container), 0.45);
  border-radius: 2px;
}
</style>
