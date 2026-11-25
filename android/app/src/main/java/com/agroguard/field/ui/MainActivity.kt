package com.agroguard.field.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.agroguard.field.data.FieldCaseEntity
import com.agroguard.field.model.BoundingBoxNormalized
import com.agroguard.field.model.DiagnosisOutput
import com.agroguard.field.model.FarmerContextInput
import java.io.File

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                CropAnalyzerScreen()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CropAnalyzerScreen(vm: FieldDiagViewModel = viewModel()) {
    val netState by vm.networkState.collectAsState()
    val diagnosis by vm.diagnosis.collectAsState()
    val promptState by vm.promptState.collectAsState()
    val banner by vm.statusBanner.collectAsState()
    val isCloudLoading by vm.isCloudLoading.collectAsState()
    val savedCases by vm.savedCases.collectAsState(initial = emptyList())

    var activeTab by remember { mutableIntStateOf(0) }
    var showMoreDetails by remember { mutableStateOf(false) }
    var capturedBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var activeDemoSampleId by remember { mutableStateOf<String?>(null) }
    var boundingBox by remember { mutableStateOf(BoundingBoxNormalized()) }

    var selectedCrop by remember { mutableStateOf("auto") }
    var selectedPart by remember { mutableStateOf("unknown") }
    var selectedSymptom by remember { mutableStateOf("unknown") }
    var selectedStage by remember { mutableStateOf("unknown") }
    var selectedFieldCondition by remember { mutableStateOf("unknown") }
    var selectedSoilMoisture by remember { mutableStateOf("unknown") }
    var selectedSunlight by remember { mutableStateOf("unknown") }
    var selectedRecentInputs by remember { mutableStateOf("unknown") }

    val currentContext = FarmerContextInput(
        suspectedCropId = selectedCrop,
        plantPart = selectedPart,
        primarySymptom = selectedSymptom,
        growthStage = selectedStage,
        fieldCondition = selectedFieldCondition,
        soilMoisture = selectedSoilMoisture,
        sunlightExposure = selectedSunlight,
        recentInputs = selectedRecentInputs
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("CropAnalyzer", fontWeight = FontWeight.Bold, color = Color(0xFF14532D)) },
                actions = {
                    val netLabel = when (netState.preferredTransport.name) {
                        "WIFI" -> "WIFI"
                        "TELCO" -> "MOBILE DATA"
                        else -> "OFFLINE"
                    }
                    Text(
                        text = netLabel,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(end = 16.dp)
                    )
                }
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = activeTab == 0,
                    onClick = { activeTab = 0 },
                    icon = { Icon(Icons.Default.CameraAlt, contentDescription = "Check") },
                    label = { Text("Check") }
                )
                NavigationBarItem(
                    selected = activeTab == 1,
                    onClick = { activeTab = 1 },
                    icon = { Icon(Icons.Default.Book, contentDescription = "30 Crops") },
                    label = { Text("30 Crops") }
                )
                NavigationBarItem(
                    selected = activeTab == 2,
                    onClick = { activeTab = 2 },
                    icon = { Icon(Icons.Default.Folder, contentDescription = "Saved") },
                    label = { Text("Saved (${savedCases.size})") }
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (!netState.isAvailable) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBEB)),
                    border = BorderStroke(1.dp, Color(0xFFFCD34D))
                ) {
                    Text(
                        text = "Offline Mode — works with no internet across 30 crops and water, sun, soil & fertilizer checks.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF78350F),
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            if (isCloudLoading) {
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFEBF3EB))) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        Text(
                            text = "Checking online for a second opinion...",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            banner?.let { msg ->
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF3F5F0))) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = msg,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = { vm.clearBanner() }) {
                            Text("OK")
                        }
                    }
                }
            }

            when (activeTab) {
                0 -> {
                    // Tab 0: Live Camera + Photo Gallery + Test Mode + 2 Simple Questions + Check Plant Now
                    CameraAndBoundingBoxSection(
                        capturedBitmap = capturedBitmap,
                        boundingBox = boundingBox,
                        activeDemoSampleId = activeDemoSampleId,
                        onBitmapCaptured = { bmp ->
                            capturedBitmap = bmp
                            activeDemoSampleId = null
                        },
                        onDemoSampleSelected = { sample, bmp ->
                            capturedBitmap = bmp
                            activeDemoSampleId = sample.id
                            selectedCrop = sample.suggestedCropId
                            selectedSymptom = sample.suggestedSymptom
                            vm.showStatus(
                                "Test photo loaded: ${sample.label}. Tap Check Plant Now below (or change crop to 'I do not know')."
                            )
                        },
                        onClearToCamera = {
                            capturedBitmap = null
                            activeDemoSampleId = null
                        },
                        onBoundingBoxChange = { box -> boundingBox = box },
                        onStatusMessage = { msg -> vm.showStatus(msg) }
                    )

                    Text(
                        text = "Tell Us What You See (Optional)",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )

                    CropPulldownField(
                        label = "1. Which crop is this? (30 Crops)",
                        selectedValue = selectedCrop,
                        options = listOf(
                            "auto" to "I do not know — Check all 30 crops",
                            "rice" to "Rice (Oryza sativa)",
                            "maize" to "Maize / Corn (Zea mays)",
                            "cassava" to "Cassava (Manihot esculenta)",
                            "sweet_potato" to "Sweet Potato (Ipomoea batatas)",
                            "sugarcane" to "Sugarcane (Saccharum officinarum)",
                            "coconut" to "Coconut (Cocos nucifera)",
                            "oil_palm" to "Oil Palm (Elaeis guineensis)",
                            "rubber" to "Natural Rubber (Hevea brasiliensis)",
                            "banana" to "Banana / Plantain (Musa acuminata)",
                            "mango" to "Mango (Mangifera indica)",
                            "papaya" to "Papaya (Carica papaya)",
                            "pineapple" to "Pineapple (Ananas comosus)",
                            "durian" to "Durian (Durio zibethinus)",
                            "coffee" to "Coffee (Coffea canephora / C. arabica)",
                            "cacao" to "Cacao (Theobroma cacao)",
                            "black_pepper" to "Black Pepper (Piper nigrum)",
                            "chili" to "Chili Pepper (Capsicum annuum)",
                            "tomato" to "Tomato (Solanum lycopersicum)",
                            "eggplant" to "Eggplant / Brinjal (Solanum melongena)",
                            "okra" to "Okra / Lady's Finger (Abelmoschus esculentus)",
                            "yardlong_bean" to "Yardlong Bean (Vigna unguiculata)",
                            "mungbean" to "Mungbean (Vigna radiata)",
                            "soybean" to "Soybean (Glycine max)",
                            "groundnut" to "Groundnut / Peanut (Arachis hypogaea)",
                            "water_spinach" to "Water Spinach / Kangkong (Ipomoea aquatica)",
                            "cashew" to "Cashew (Anacardium occidentale)",
                            "shallot" to "Shallot / Red Onion (Allium cepa var. aggregatum)",
                            "bitter_gourd" to "Bitter Gourd / Ampalaya (Momordica charantia)",
                            "calamansi" to "Calamansi / Tropical Lime (Citrus × microcarpa)",
                            "taro" to "Taro / Gabi (Colocasia esculenta)"
                        ),
                        onSelect = { selectedCrop = it }
                    )

                    CropPulldownField(
                        label = "2. What looks wrong?",
                        selectedValue = selectedSymptom,
                        options = listOf(
                            "unknown" to "I do not know",
                            "spots_lesions" to "Brown or black spots / rings",
                            "tip_scorch" to "Burnt tips or dried leaf edges",
                            "yellowing_mosaic" to "Yellow or pale green leaves",
                            "bleached_distorted" to "White patches or curled new leaves",
                            "powdery_mold" to "White powder, orange dust, or fuzzy mold",
                            "wilting_rot" to "Wilting, drooping, or soft rot",
                            "chewing_holes" to "Holes chewed by worms or bugs",
                            "insects_webbing" to "Visible bugs, worms, or webs",
                            "healthy_unsure" to "Looks healthy (just checking)"
                        ),
                        onSelect = { selectedSymptom = it }
                    )

                    OutlinedButton(
                        onClick = { showMoreDetails = !showMoreDetails },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = if (showMoreDetails) {
                                "Hide Extra Farm Details"
                            } else {
                                "More Farm Details (Optional — Soil, Sun, Fertilizer)"
                            },
                            color = Color(0xFF1B5E20)
                        )
                    }

                    if (showMoreDetails) {
                        CropPulldownField(
                            label = "Which part is sick?",
                            selectedValue = selectedPart,
                            options = listOf(
                                "unknown" to "I do not know / Whole plant",
                                "leaf_upper" to "Top of leaf",
                                "leaf_lower" to "Underside of leaf",
                                "stem_stalk" to "Stem, branch, or trunk",
                                "fruit_pod" to "Fruit, pod, cob, or grain",
                                "root_collar" to "Roots or base near soil",
                                "whole_plant" to "Whole plant looks sick"
                            ),
                            onSelect = { selectedPart = it }
                        )

                        CropPulldownField(
                            label = "Plant age",
                            selectedValue = selectedStage,
                            options = listOf(
                                "unknown" to "I do not know",
                                "seedling" to "Young seedling",
                                "vegetative" to "Growing leaves & stems",
                                "flowering" to "Flowering",
                                "fruiting_grain" to "Growing fruit, pods, or grain",
                                "mature" to "Ready to harvest"
                            ),
                            onSelect = { selectedStage = it }
                        )

                        CropPulldownField(
                            label = "Weather & spread",
                            selectedValue = selectedFieldCondition,
                            options = listOf(
                                "unknown" to "I do not know",
                                "humid_rainy" to "Rainy or very humid lately",
                                "hot_dry" to "Very hot and dry lately",
                                "storm_wind" to "Strong wind or storm lately",
                                "uniform_patch" to "Whole patch looks the same",
                                "isolated_plant" to "Only 1 or 2 plants",
                                "spreading_plot" to "Spreading fast across field"
                            ),
                            onSelect = { selectedFieldCondition = it }
                        )

                        CropPulldownField(
                            label = "Soil wetness",
                            selectedValue = selectedSoilMoisture,
                            options = listOf(
                                "unknown" to "I do not know",
                                "normal" to "Normal (moist, drains well)",
                                "dry_cracked" to "Dry, cracked soil (needs water)",
                                "waterlogged" to "Too wet / standing water",
                                "saline_acidic" to "Salty coastal or sour soil"
                            ),
                            onSelect = { selectedSoilMoisture = it }
                        )

                        CropPulldownField(
                            label = "Sunlight",
                            selectedValue = selectedSunlight,
                            options = listOf(
                                "unknown" to "I do not know",
                                "full_sun" to "Normal full sun",
                                "heavy_shade" to "Too shady (needs more sun)",
                                "intense_heat" to "Harsh midday sunburn"
                            ),
                            onSelect = { selectedSunlight = it }
                        )

                        CropPulldownField(
                            label = "Fertilizer or weed spray (2 weeks)",
                            selectedValue = selectedRecentInputs,
                            options = listOf(
                                "unknown" to "I do not know",
                                "none" to "None used",
                                "heavy_fertilizer" to "Heavy fertilizer or fresh manure (last 14 days)",
                                "herbicide_nearby" to "Weedkiller sprayed nearby",
                                "no_fertilizer_deficit" to "No fertilizer all season (weak soil)"
                            ),
                            onSelect = { selectedRecentInputs = it }
                        )
                    }

                    Button(
                        onClick = {
                            val bmp = capturedBitmap
                            if (bmp == null) {
                                vm.showStatus("Take a leaf photo, tap Gallery, or open Test Mode first.")
                            } else {
                                vm.analyzeCapturedImage(
                                    bitmap = bmp,
                                    box = boundingBox,
                                    context = currentContext,
                                    demoSampleId = activeDemoSampleId
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1B5E20)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                    ) {
                        Text("Check Plant Now")
                    }

                    diagnosis?.let { result ->
                        DiagnosisResultSection(
                            result = result,
                            onAskGeminiClick = {
                                val bmp = capturedBitmap
                                if (bmp != null) {
                                    vm.askGeminiSecondOpinion(bmp, boundingBox, currentContext)
                                } else {
                                    vm.showStatus("Take or pick a photo first.")
                                }
                            }
                        )
                    }
                }

                1 -> {
                    OfflineCatalogTab(vm = vm)
                }

                2 -> {
                    SavedCasesTab(
                        savedCases = savedCases,
                        isNetworkAvailable = netState.isAvailable,
                        isCloudLoading = isCloudLoading,
                        onRetryGemini = { entity -> vm.retryGeminiForSavedCase(entity) },
                        onDeleteCase = { entity -> vm.deleteSavedCase(entity) }
                    )
                }
            }
        }
    }

    // Prompt 1: Ask Y/N to check online when Wi-Fi or mobile data is available
    when (val modal = promptState) {
        is PromptModalState.AskAnalyzeViaGemini -> {
            AlertDialog(
                onDismissRequest = { vm.onUserRespondsGeminiPrompt(false) },
                title = { Text("Not Sure Offline — Check Online Now?") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(modal.reason)
                        Text(modal.signalLabel, fontWeight = FontWeight.SemiBold)
                        Text("Only sends the small leaf photo inside the green box. Uses free Wi-Fi first.")
                    }
                },
                confirmButton = {
                    Button(
                        onClick = { vm.onUserRespondsGeminiPrompt(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1B5E20))
                    ) {
                        Text("Yes, Check Online")
                    }
                },
                dismissButton = {
                    OutlinedButton(onClick = { vm.onUserRespondsGeminiPrompt(false) }) {
                        Text("No")
                    }
                }
            )
        }

        // Prompt 2: Ask whether to delete unfinished photo from phone
        is PromptModalState.AskDeleteUnresolvedFromMemory -> {
            AlertDialog(
                onDismissRequest = { vm.onUserRespondsDeletePrompt(false) },
                title = { Text("Delete Unfinished Photo?") },
                text = {
                    Text("${modal.reason} Do you want to delete this photo from your phone, or keep it saved to check later?")
                },
                confirmButton = {
                    Button(
                        onClick = { vm.onUserRespondsDeletePrompt(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB91C1C))
                    ) {
                        Text("Yes, Delete Photo")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { vm.onUserRespondsDeletePrompt(false) }) {
                        Text("No, Keep Saved")
                    }
                }
            )
        }

        PromptModalState.None -> Unit
    }
}

@Composable
private fun DiagnosisResultSection(
    result: DiagnosisOutput,
    onAskGeminiClick: () -> Unit
) {
    val isBroad = result.category == "Broad Match"
    val isAbiotic = result.category == "Abiotic"
    val isHealthy = result.category == "Healthy"

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFDCE2D7))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = if (result.source == "GEMINI_CLOUD") {
                        val via = if (result.transportUsed == "TELCO") "Mobile Data" else "Wi-Fi"
                        "Online Second Opinion ($via)"
                    } else {
                        "Checked Offline (No Data Used)"
                    },
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF1B5E20)
                )
                Text(
                    text = "${result.probabilityPercent}% match",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            HorizontalDivider(color = Color(0xFFECEFE9))

            Text(
                text = "${result.cropCommonName} (${result.cropScientificName})",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = result.diagnosisName,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = when {
                    isHealthy -> Color(0xFF1B5E20)
                    isAbiotic || isBroad -> Color(0xFFB45309)
                    else -> Color(0xFF9A3412)
                }
            )
            Text(
                text = result.pathogenScientificName,
                style = MaterialTheme.typography.bodySmall,
                fontStyle = FontStyle.Italic,
                color = Color(0xFF475449)
            )
            Text(
                text = result.summary,
                style = MaterialTheme.typography.bodyMedium
            )

            HorizontalDivider(color = Color(0xFFECEFE9))

            Text("What to Do Today", fontWeight = FontWeight.SemiBold, color = Color(0xFF1B5E20))
            result.recommendations.immediateActions.forEach { action ->
                Text("• $action", style = MaterialTheme.typography.bodySmall)
            }

            if (result.recommendations.biologicalControl.isNotEmpty()) {
                Text("Natural / Organic Care", fontWeight = FontWeight.SemiBold, color = Color(0xFF1B5E20))
                result.recommendations.biologicalControl.forEach { bio ->
                    Text("• $bio", style = MaterialTheme.typography.bodySmall)
                }
            }

            Text("Spray & Safety Advice", fontWeight = FontWeight.SemiBold)
            Text(result.recommendations.chemicalGuidance, style = MaterialTheme.typography.bodySmall)

            if (result.recommendations.prevention.isNotEmpty()) {
                Text("How to Prevent Next Time", fontWeight = FontWeight.SemiBold)
                result.recommendations.prevention.forEach { tip ->
                    Text("• $tip", style = MaterialTheme.typography.bodySmall)
                }
            }

            if (result.source == "OFFLINE_ON_DEVICE") {
                TextButton(
                    onClick = onAskGeminiClick,
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text(
                        text = "Not sure? Check online for a second opinion",
                        color = Color(0xFF1B5E20),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun OfflineCatalogTab(vm: FieldDiagViewModel) {
    var query by remember { mutableStateOf("") }
    var selectedFilterId by remember { mutableStateOf("abiotic_causes") }

    val filteredCrops = remember(query) {
        val q = query.trim().lowercase()
        if (q.isEmpty()) {
            vm.allCrops
        } else {
            vm.allCrops.filter { crop ->
                crop.commonName.lowercase().contains(q) ||
                    crop.scientificName.lowercase().contains(q) ||
                    crop.conditions.any {
                        it.name.lowercase().contains(q) || it.scientificName.lowercase().contains(q)
                    }
            }
        }
    }

    val filteredAbiotic = remember(query) {
        val q = query.trim().lowercase()
        if (q.isEmpty()) {
            vm.allAbioticCauses
        } else {
            vm.allAbioticCauses.filter {
                it.name.lowercase().contains(q) || it.summary.lowercase().contains(q)
            }
        }
    }

    OutlinedTextField(
        value = query,
        onValueChange = { query = it },
        label = { Text("Search 30 crops or problems...") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth()
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = selectedFilterId == "abiotic_causes",
            onClick = { selectedFilterId = "abiotic_causes" },
            label = { Text("Water, Sun, Soil & Fertilizer (9)") }
        )
        filteredCrops.forEach { crop ->
            FilterChip(
                selected = selectedFilterId == crop.id,
                onClick = { selectedFilterId = crop.id },
                label = { Text(crop.commonName) }
            )
        }
    }

    if (selectedFilterId == "abiotic_causes" || (filteredCrops.isEmpty() && filteredAbiotic.isNotEmpty())) {
        filteredAbiotic.forEach { cond ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFDCE2D7))
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Water, Sun, Soil, or Fertilizer", style = MaterialTheme.typography.labelSmall, color = Color(0xFFB45309))
                    Text(cond.name, fontWeight = FontWeight.Bold)
                    Text(cond.summary, style = MaterialTheme.typography.bodySmall)
                    cond.recommendations.immediateActions.firstOrNull()?.let { act ->
                        Text("What to do: $act", style = MaterialTheme.typography.bodySmall, color = Color(0xFF1B5E20))
                    }
                }
            }
        }
    } else {
        val activeCrop = filteredCrops.firstOrNull { it.id == selectedFilterId } ?: filteredCrops.firstOrNull()
        activeCrop?.let { crop ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFEBF3EB))
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(crop.commonName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(crop.scientificName, fontStyle = FontStyle.Italic, style = MaterialTheme.typography.bodySmall)
                    Text("Grown in: ${crop.globalRegions}", style = MaterialTheme.typography.labelSmall)
                }
            }
            crop.conditions.forEach { cond ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFDCE2D7))
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(cond.category, style = MaterialTheme.typography.labelSmall, color = Color(0xFF5A675C))
                        Text(cond.name, fontWeight = FontWeight.Bold)
                        Text(cond.scientificName, fontStyle = FontStyle.Italic, style = MaterialTheme.typography.bodySmall)
                        Text(cond.summary, style = MaterialTheme.typography.bodySmall)
                        cond.recommendations.immediateActions.firstOrNull()?.let { act ->
                            Text("What to do: $act", style = MaterialTheme.typography.bodySmall, color = Color(0xFF1B5E20))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SavedCasesTab(
    savedCases: List<FieldCaseEntity>,
    isNetworkAvailable: Boolean,
    isCloudLoading: Boolean,
    onRetryGemini: (FieldCaseEntity) -> Unit,
    onDeleteCase: (FieldCaseEntity) -> Unit
) {
    if (savedCases.isEmpty()) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, Color(0xFFDCE2D7))
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("No Saved Photos Yet", fontWeight = FontWeight.Bold)
                Text(
                    "Plant checks and photos saved on your phone will show up here.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF5A675C)
                )
            }
        }
        return
    }

    savedCases.forEach { entry ->
        val thumbnail = remember(entry.imageFilePath) {
            val file = File(entry.imageFilePath)
            if (entry.imageFilePath.isNotBlank() && file.exists()) {
                BitmapFactory.decodeFile(file.absolutePath)
            } else {
                null
            }
        }
        val isUnresolved = entry.status == "UNRESOLVED_SAVED"

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, Color(0xFFDCE2D7))
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    thumbnail?.let { bmp ->
                        Image(
                            bitmap = bmp.asImageBitmap(),
                            contentDescription = entry.diagnosisName,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(60.dp)
                                .clip(RoundedCornerShape(8.dp))
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = when (entry.status) {
                                "UNRESOLVED_SAVED" -> "Needs online check · Saved on phone"
                                "DIAGNOSED_GEMINI" -> "${entry.probabilityPercent}% match · Online Check"
                                else -> "${entry.probabilityPercent}% match · Offline"
                            },
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF5A675C)
                        )
                        Text(
                            text = "${entry.cropCommonName} — ${entry.diagnosisName}",
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Text(
                            text = entry.pathogenScientificName,
                            fontStyle = FontStyle.Italic,
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF475449)
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (isUnresolved) {
                        Button(
                            onClick = { onRetryGemini(entry) },
                            enabled = isNetworkAvailable && !isCloudLoading,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1B5E20)),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(if (isNetworkAvailable) "Check Online Now" else "No Signal")
                        }
                    } else {
                        Spacer(modifier = Modifier.weight(1f))
                    }

                    OutlinedButton(
                        onClick = { onDeleteCase(entry) },
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "Delete",
                            tint = Color(0xFFB91C1C),
                            modifier = Modifier.size(16.dp)
                        )
                        Text(" Delete", color = Color(0xFFB91C1C))
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CropPulldownField(
    label: String,
    selectedValue: String,
    options: List<Pair<String, String>>,
    onSelect: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val display = options.firstOrNull { it.first == selectedValue }?.second ?: selectedValue

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = display,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { (id, title) ->
                DropdownMenuItem(
                    text = { Text(title) },
                    onClick = {
                        onSelect(id)
                        expanded = false
                    }
                )
            }
        }
    }
}
