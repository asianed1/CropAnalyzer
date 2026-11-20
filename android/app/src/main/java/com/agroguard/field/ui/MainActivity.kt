package com.agroguard.field.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.agroguard.field.model.BoundingBoxNormalized
import com.agroguard.field.model.FarmerContextInput

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
    val savedCases by vm.savedCases.collectAsState(initial = emptyList())

    var activeTab by remember { mutableIntStateOf(0) }
    var selectedCrop by remember { mutableStateOf("auto") }
    var selectedPart by remember { mutableStateOf("unknown") }
    var selectedSymptom by remember { mutableStateOf("unknown") }
    var selectedStage by remember { mutableStateOf("unknown") }
    var selectedFieldCondition by remember { mutableStateOf("unknown") }
    var selectedSoilMoisture by remember { mutableStateOf("unknown") }
    var selectedSunlight by remember { mutableStateOf("unknown") }
    var selectedRecentInputs by remember { mutableStateOf("unknown") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("CropAnalyzer", fontWeight = FontWeight.Bold) },
                actions = {
                    Text(
                        text = netState.preferredTransport.name,
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
                    icon = { Icon(Icons.Default.CameraAlt, contentDescription = "Scan") },
                    label = { Text("Scan") }
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
                    icon = { Icon(Icons.Default.Folder, contentDescription = "Cases") },
                    label = { Text("Cases (${savedCases.size})") }
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            banner?.let { msg ->
                Card {
                    Text(msg, modifier = Modifier.padding(12.dp))
                }
            }

            // Guided CameraX + Bounding Box Viewfinder Container
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f),
                border = BorderStroke(2.dp, Color(0xFF1B5E20))
            ) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("CameraX Guided Bounding-Box Frame (Well-Lit Check Active)")
                }
            }

            Button(
                onClick = {
                    // Wire live CameraX captured Bitmap + BoundingBoxNormalized here
                    val placeholderBitmap = android.graphics.Bitmap.createBitmap(
                        320,
                        240,
                        android.graphics.Bitmap.Config.ARGB_8888
                    )
                    vm.analyzeCapturedImage(
                        bitmap = placeholderBitmap,
                        box = BoundingBoxNormalized(),
                        context = FarmerContextInput(
                            suspectedCropId = selectedCrop,
                            plantPart = selectedPart,
                            primarySymptom = selectedSymptom,
                            growthStage = selectedStage,
                            fieldCondition = selectedFieldCondition,
                            soilMoisture = selectedSoilMoisture,
                            sunlightExposure = selectedSunlight,
                            recentInputs = selectedRecentInputs
                        )
                    )
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1B5E20)),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) {
                Text("Run Offline Analysis")
            }

            // Farmer Contextual Pulldown Menus (All include "Do not know")
            CropPulldownField(
                label = "Suspected Crop (30 Southeast Asian Crops)",
                selectedValue = selectedCrop,
                options = listOf(
                    "auto" to "Do not know — Auto-Detect Crop",
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
                label = "Plant Part",
                selectedValue = selectedPart,
                options = listOf(
                    "unknown" to "Do not know / Multiple parts",
                    "leaf_upper" to "Leaf (Upper Surface)",
                    "leaf_lower" to "Leaf (Underside)",
                    "stem_stalk" to "Stem / Stalk / Trunk",
                    "fruit_pod" to "Fruit / Pod / Cob / Panicle",
                    "root_collar" to "Root / Crown / Collar",
                    "whole_plant" to "Whole Plant Canopy"
                ),
                onSelect = { selectedPart = it }
            )

            CropPulldownField(
                label = "Observed Symptom",
                selectedValue = selectedSymptom,
                options = listOf(
                    "unknown" to "Do not know / Unsure",
                    "spots_lesions" to "Spots, Rings, or Necrotic Lesions",
                    "tip_scorch" to "Burnt Leaf Tips / Scorched Edges",
                    "yellowing_mosaic" to "Yellowing, Pale Leaves, or Mosaic",
                    "bleached_distorted" to "Bleached Patches / Twisted New Shoots",
                    "powdery_mold" to "Powdery, Rust Pustules, or Fuzzy Mold",
                    "wilting_rot" to "Wilting, Drooping, or Soft Rot",
                    "chewing_holes" to "Ragged Holes, Torn Leaves, or Frass",
                    "insects_webbing" to "Visible Insects, Larvae, Scale, or Webbing",
                    "healthy_unsure" to "No Clear Lesion / Healthy Check"
                ),
                onSelect = { selectedSymptom = it }
            )

            CropPulldownField(
                label = "Growth Stage",
                selectedValue = selectedStage,
                options = listOf(
                    "unknown" to "Do not know",
                    "seedling" to "Seedling / Emergence",
                    "vegetative" to "Vegetative Growth",
                    "flowering" to "Flowering / Tasseling",
                    "fruiting_grain" to "Fruiting / Pod / Grain Fill",
                    "mature" to "Mature / Pre-Harvest"
                ),
                onSelect = { selectedStage = it }
            )

            CropPulldownField(
                label = "Weather & Plot Pattern",
                selectedValue = selectedFieldCondition,
                options = listOf(
                    "unknown" to "Do not know",
                    "humid_rainy" to "Monsoon / Recent Rain / High Humidity",
                    "hot_dry" to "Hot & Dry / Dry-Season Stress",
                    "storm_wind" to "Strong Wind / Typhoon / Storm Damage",
                    "uniform_patch" to "Uniform Across Low or Distinct Soil Patch",
                    "isolated_plant" to "Isolated to 1–2 Plants",
                    "spreading_plot" to "Spreading Rapidly Across Plot"
                ),
                onSelect = { selectedFieldCondition = it }
            )

            CropPulldownField(
                label = "Soil Moisture & Drainage",
                selectedValue = selectedSoilMoisture,
                options = listOf(
                    "unknown" to "Do not know",
                    "normal" to "Moist & Well-Drained (Normal)",
                    "dry_cracked" to "Dry / Cracked Soil (Lack of Water)",
                    "waterlogged" to "Waterlogged / Standing Water / Overwatered",
                    "saline_acidic" to "Brackish / Coastal Salt / Acid-Sulfate Soil"
                ),
                onSelect = { selectedSoilMoisture = it }
            )

            CropPulldownField(
                label = "Sunlight Exposure",
                selectedValue = selectedSunlight,
                options = listOf(
                    "unknown" to "Do not know",
                    "full_sun" to "Normal Full Sun",
                    "heavy_shade" to "Too Little Sunlight / Heavy Shade",
                    "intense_heat" to "Extreme Midday Heat / Sunscald"
                ),
                onSelect = { selectedSunlight = it }
            )

            CropPulldownField(
                label = "Recent Fertilizer or Spray (14 Days)",
                selectedValue = selectedRecentInputs,
                options = listOf(
                    "unknown" to "Do not know",
                    "none" to "No Recent Fertilizer or Herbicide",
                    "heavy_fertilizer" to "Heavy Fertilizer or Raw Manure (Last 14 Days)",
                    "herbicide_nearby" to "Herbicide / Weedkiller Sprayed Nearby",
                    "no_fertilizer_deficit" to "No Fertilizer Applied This Season (Depleted Soil)"
                ),
                onSelect = { selectedRecentInputs = it }
            )

            // Diagnostic Result Card
            diagnosis?.let { result ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("${result.cropCommonName} — ${result.diagnosisName}", fontWeight = FontWeight.Bold)
                        Text(
                            "${result.cropScientificName} / ${result.pathogenScientificName}",
                            fontStyle = FontStyle.Italic
                        )
                        Text("Probability: ${result.probabilityPercent}% (${result.source})")
                        Text(result.summary)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Immediate Actions:", fontWeight = FontWeight.SemiBold)
                        result.recommendations.immediateActions.forEach { action ->
                            Text("• $action")
                        }
                    }
                }
            }

            Text("Saved Field Cases in Local Memory: ${savedCases.size}")
        }
    }

    // Prompt 1: Ask Y/N to analyze mysterious disease/pest via Gemini when Wi-Fi or Telco is available
    when (val modal = promptState) {
        is PromptModalState.AskAnalyzeViaGemini -> {
            AlertDialog(
                onDismissRequest = { vm.onUserRespondsGeminiPrompt(false) },
                title = { Text("Analyze Mysterious Crop Issue via Gemini?") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(modal.reason)
                        Text(modal.signalLabel, fontWeight = FontWeight.SemiBold)
                        Text("Proceed to analyze online via Gemini API? (Wi-Fi is prioritized first over Telco cellular.)")
                    }
                },
                confirmButton = {
                    Button(
                        onClick = { vm.onUserRespondsGeminiPrompt(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1B5E20))
                    ) {
                        Text("Yes, Analyze via Gemini")
                    }
                },
                dismissButton = {
                    OutlinedButton(onClick = { vm.onUserRespondsGeminiPrompt(false) }) {
                        Text("No")
                    }
                }
            )
        }

        // Prompt 2: User answered NO (or offline) -> ask whether to delete case from memory
        is PromptModalState.AskDeleteUnresolvedFromMemory -> {
            AlertDialog(
                onDismissRequest = { vm.onUserRespondsDeletePrompt(false) },
                title = { Text("Delete Unresolved Case from Memory?") },
                text = {
                    Text("${modal.reason} Should this unresolved case and its photo be deleted from device memory?")
                },
                confirmButton = {
                    Button(
                        onClick = { vm.onUserRespondsDeletePrompt(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB91C1C))
                    ) {
                        Text("Yes, Delete from Memory")
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
