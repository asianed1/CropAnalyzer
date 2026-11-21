package com.agroguard.field.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.agroguard.field.model.BoundingBoxNormalized
import kotlin.math.max

@Composable
fun CameraAndBoundingBoxSection(
    capturedBitmap: Bitmap?,
    boundingBox: BoundingBoxNormalized,
    onBitmapCaptured: (Bitmap) -> Unit,
    onClearToCamera: () -> Unit,
    onBoundingBoxChange: (BoundingBoxNormalized) -> Unit,
    onStatusMessage: (String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var torchEnabled by remember { mutableStateOf(false) }
    var isCapturing by remember { mutableStateOf(false) }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var boundCamera by remember { mutableStateOf<Camera?>(null) }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) {
            onStatusMessage("Camera was turned off. You can still pick a photo from your Gallery.")
        }
    }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            val decoded = decodeUriToBitmap(context, uri)
            if (decoded != null) {
                onBitmapCaptured(decoded)
                onBoundingBoxChange(BoundingBoxNormalized())
                onStatusMessage("Photo loaded! Slide the green box over the sick leaf, then tap Check Plant Now.")
            } else {
                onStatusMessage("Could not open that photo. Please try another picture.")
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Action Bar: Camera / Gallery
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (capturedBitmap == null) {
                Button(
                    onClick = {
                        if (!hasCameraPermission) {
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                            return@Button
                        }
                        val capture = imageCapture
                        if (capture == null || isCapturing) {
                            onStatusMessage("Camera is starting up. Please wait a second.")
                            return@Button
                        }
                        isCapturing = true
                        capture.takePicture(
                            ContextCompat.getMainExecutor(context),
                            object : ImageCapture.OnImageCapturedCallback() {
                                override fun onCaptureSuccess(image: ImageProxy) {
                                    isCapturing = false
                                    val bmp = imageProxyToUprightBitmap(image)
                                    if (bmp != null) {
                                        torchEnabled = false
                                        boundCamera?.cameraControl?.enableTorch(false)
                                        onBitmapCaptured(bmp)
                                        onBoundingBoxChange(BoundingBoxNormalized())
                                        onStatusMessage("Photo taken! Now tap Check Plant Now below.")
                                    } else {
                                        onStatusMessage("Could not read photo. Please take it again.")
                                    }
                                }

                                override fun onError(exception: ImageCaptureException) {
                                    isCapturing = false
                                    onStatusMessage("Could not take photo: ${exception.message ?: "Try again"}")
                                }
                            }
                        )
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1B5E20)),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                    Text(
                        text = if (isCapturing) " Capturing..." else " Take Photo",
                        style = MaterialTheme.typography.labelLarge
                    )
                }
            } else {
                OutlinedButton(
                    onClick = onClearToCamera,
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                    Text(" Camera", style = MaterialTheme.typography.labelLarge)
                }
            }

            OutlinedButton(
                onClick = {
                    photoPickerLauncher.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                    )
                },
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(18.dp))
                Text(" Gallery", style = MaterialTheme.typography.labelLarge)
            }
        }

        // Viewport Card: Live CameraX OR Captured Photo + Touch-Draggable Bounding Box
        Card(
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.5.dp, Color(0xFF1B5E20)),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111612))
        ) {
            if (capturedBitmap == null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(4f / 3f),
                    contentAlignment = Alignment.Center
                ) {
                    if (hasCameraPermission) {
                        val previewView = remember {
                            PreviewView(context).apply {
                                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                            }
                        }

                        DisposableEffect(lifecycleOwner) {
                            val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
                            var providerRef: ProcessCameraProvider? = null
                            val listener = Runnable {
                                runCatching {
                                    val cameraProvider = cameraProviderFuture.get()
                                    providerRef = cameraProvider
                                    val preview = Preview.Builder().build().also {
                                        it.setSurfaceProvider(previewView.surfaceProvider)
                                    }
                                    val captureUseCase = ImageCapture.Builder()
                                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                                        .build()
                                    imageCapture = captureUseCase
                                    cameraProvider.unbindAll()
                                    val cam = cameraProvider.bindToLifecycle(
                                        lifecycleOwner,
                                        CameraSelector.DEFAULT_BACK_CAMERA,
                                        preview,
                                        captureUseCase
                                    )
                                    boundCamera = cam
                                }.onFailure {
                                    onStatusMessage("Camera could not open. Tap Gallery to pick a photo instead.")
                                }
                            }
                            cameraProviderFuture.addListener(listener, ContextCompat.getMainExecutor(context))
                            onDispose {
                                runCatching { providerRef?.unbindAll() }
                                boundCamera = null
                                imageCapture = null
                            }
                        }

                        AndroidView(
                            factory = { previewView },
                            modifier = Modifier.fillMaxSize()
                        )

                        // Fixed QR-Style Center Framing Guide Over Live Camera
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val left = size.width * 0.16f
                            val top = size.height * 0.16f
                            val w = size.width * 0.68f
                            val h = size.height * 0.68f
                            val scrim = Color.Black.copy(alpha = 0.40f)
                            drawRect(scrim, Offset(0f, 0f), Size(size.width, top))
                            drawRect(scrim, Offset(0f, top + h), Size(size.width, size.height - (top + h)))
                            drawRect(scrim, Offset(0f, top), Size(left, h))
                            drawRect(scrim, Offset(left + w, top), Size(size.width - (left + w), h))
                            drawRect(
                                color = Color(0xFF4ADE80),
                                topLeft = Offset(left, top),
                                size = Size(w, h),
                                style = Stroke(width = 5f)
                            )
                        }

                        // Flash Light Toggle
                        Row(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(8.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    val next = !torchEnabled
                                    torchEnabled = next
                                    boundCamera?.cameraControl?.enableTorch(next)
                                },
                                colors = ButtonDefaults.outlinedButtonColors(
                                    containerColor = Color.Black.copy(alpha = 0.55f),
                                    contentColor = Color.White
                                ),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Icon(
                                    imageVector = if (torchEnabled) Icons.Default.FlashOn else Icons.Default.FlashOff,
                                    contentDescription = "Flash Light",
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(if (torchEnabled) " Light On" else " Light", style = MaterialTheme.typography.labelSmall)
                            }
                        }

                        Text(
                            text = "Put sick leaf inside the green box — move closer or farther",
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .padding(8.dp)
                                .background(Color.Black.copy(alpha = 0.65f), RoundedCornerShape(8.dp))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    } else {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                text = "Allow camera access to take a leaf photo, or tap Gallery to pick an existing photo.",
                                color = Color.White,
                                style = MaterialTheme.typography.bodySmall
                            )
                            Button(
                                onClick = { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1B5E20))
                            ) {
                                Text("Turn On Camera")
                            }
                        }
                    }
                }
            } else {
                // Captured/Picked Photo with Simple 1-Finger Move Only (Fixed Size Box)
                val aspect = (capturedBitmap.width.toFloat() / max(1, capturedBitmap.height).toFloat())
                    .coerceIn(0.75f, 1.75f)
                var viewSize by remember { mutableStateOf(IntSize(1, 1)) }
                val latestBox by rememberUpdatedState(boundingBox)

                Column {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(aspect)
                            .clip(RoundedCornerShape(topStart = 10.dp, topEnd = 10.dp))
                            .onSizeChanged { viewSize = it }
                            .pointerInput(capturedBitmap) {
                                detectDragGestures(
                                    onDrag = { change, dragAmount ->
                                        change.consume()
                                        val box = latestBox
                                        val w = viewSize.width.coerceAtLeast(1).toFloat()
                                        val h = viewSize.height.coerceAtLeast(1).toFloat()
                                        val dx = dragAmount.x / w
                                        val dy = dragAmount.y / h

                                        val boxW = box.right - box.left
                                        val boxH = box.bottom - box.top
                                        val newLeft = (box.left + dx).coerceIn(0.02f, 0.98f - boxW)
                                        val newTop = (box.top + dy).coerceIn(0.02f, 0.98f - boxH)
                                        onBoundingBoxChange(
                                            BoundingBoxNormalized(
                                                left = newLeft,
                                                top = newTop,
                                                right = newLeft + boxW,
                                                bottom = newTop + boxH
                                            )
                                        )
                                    }
                                )
                            }
                    ) {
                        Image(
                            bitmap = capturedBitmap.asImageBitmap(),
                            contentDescription = "Leaf photo",
                            contentScale = ContentScale.FillBounds,
                            modifier = Modifier.fillMaxSize()
                        )

                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val l = boundingBox.left * size.width
                            val t = boundingBox.top * size.height
                            val r = boundingBox.right * size.width
                            val b = boundingBox.bottom * size.height
                            val scrim = Color.Black.copy(alpha = 0.44f)

                            drawRect(scrim, Offset(0f, 0f), Size(size.width, t))
                            drawRect(scrim, Offset(0f, b), Size(size.width, size.height - b))
                            drawRect(scrim, Offset(0f, t), Size(l, b - t))
                            drawRect(scrim, Offset(r, t), Size(size.width - r, b - t))

                            drawRect(
                                color = Color(0xFF4ADE80),
                                topLeft = Offset(l, t),
                                size = Size(r - l, b - t),
                                style = Stroke(width = 5f)
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1B241C))
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Slide green box over the sick leaf (if needed)",
                            color = Color(0xFFDCE8DC),
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedButton(
                            onClick = { onBoundingBoxChange(BoundingBoxNormalized()) },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF86EFAC)),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Icon(Icons.Default.CenterFocusStrong, contentDescription = null, modifier = Modifier.size(14.dp))
                            Text(" Reset Box", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

private fun imageProxyToUprightBitmap(imageProxy: ImageProxy): Bitmap? {
    return try {
        val raw = imageProxy.toBitmap()
        val rotation = imageProxy.imageInfo.rotationDegrees
        val upright = if (rotation != 0) {
            val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
            Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, true).also {
                if (it != raw) raw.recycle()
            }
        } else {
            raw
        }
        val maxDim = 1280
        val w = upright.width
        val h = upright.height
        if (w > maxDim || h > maxDim) {
            val scale = maxDim.toFloat() / max(w, h).toFloat()
            Bitmap.createScaledBitmap(
                upright,
                (w * scale).toInt().coerceAtLeast(64),
                (h * scale).toInt().coerceAtLeast(64),
                true
            ).also {
                if (it != upright) upright.recycle()
            }
        } else {
            upright
        }
    } catch (_: Throwable) {
        null
    } finally {
        imageProxy.close()
    }
}

private fun decodeUriToBitmap(context: Context, uri: Uri): Bitmap? {
    return runCatching {
        val source = ImageDecoder.createSource(context.contentResolver, uri)
        val decoded = ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            val maxDim = 1280
            val w = info.size.width
            val h = info.size.height
            if (w > maxDim || h > maxDim) {
                val scale = maxDim.toFloat() / max(w, h).toFloat()
                decoder.setTargetSize(
                    (w * scale).toInt().coerceAtLeast(64),
                    (h * scale).toInt().coerceAtLeast(64)
                )
            }
        }
        if (decoded.config == Bitmap.Config.ARGB_8888) {
            decoded
        } else {
            decoded.copy(Bitmap.Config.ARGB_8888, false).also {
                decoded.recycle()
            }
        }
    }.getOrNull()
}
