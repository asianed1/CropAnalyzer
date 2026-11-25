package com.agroguard.field.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ThreeCropWhiteCircleIcon(
    modifier: Modifier = Modifier,
    size: Dp = 44.dp
) {
    Canvas(modifier = modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height
        val sx = w / 120f
        val sy = h / 120f

        fun pt(x: Float, y: Float) = Offset(x * sx, y * sy)

        // Crisp white circle with thin deep-green outline
        drawCircle(
            color = Color.White,
            radius = 56f * sx,
            center = pt(60f, 60f)
        )
        drawCircle(
            color = Color(0xFF1B5E20),
            radius = 56f * sx,
            center = pt(60f, 60f),
            style = Stroke(width = (3.4f * sx).coerceAtLeast(1.5f))
        )

        val deepGreen = Color(0xFF1B5E20)
        val midGreen = Color(0xFF2E7D32)
        val brightGreen = Color(0xFF43A047)
        val paleMint = Color(0xFFDCFCE7)
        val leafHighlight = Color(0xFFA7F3D0)

        // 1) Left: Rice stalk & grain panicle
        val riceStem = Path().apply {
            moveTo(38f * sx, 92f * sy)
            cubicTo(37f * sx, 74f * sy, 35f * sx, 58f * sy, 30f * sx, 44f * sy)
            cubicTo(28f * sx, 38f * sy, 25f * sx, 34f * sy, 22f * sx, 31f * sy)
        }
        drawPath(
            path = riceStem,
            color = deepGreen,
            style = Stroke(width = (3f * sx).coerceAtLeast(1.4f), cap = StrokeCap.Round)
        )
        val riceLeftLeaf = Path().apply {
            moveTo(37f * sx, 82f * sy)
            cubicTo(28f * sx, 74f * sy, 23f * sx, 65f * sy, 21f * sx, 55f * sy)
            cubicTo(28f * sx, 61f * sy, 34f * sx, 69f * sy, 37f * sx, 78f * sy)
            close()
        }
        drawPath(riceLeftLeaf, color = midGreen)

        val riceRightLeaf = Path().apply {
            moveTo(37f * sx, 71f * sy)
            cubicTo(43f * sx, 64f * sy, 47f * sx, 57f * sy, 48f * sx, 51f * sy)
            cubicTo(43f * sx, 56f * sy, 39f * sx, 62f * sy, 37f * sx, 69f * sy)
            close()
        }
        drawPath(riceRightLeaf, color = brightGreen)

        val grains = listOf(
            Triple(31f, 44f, -24f) to midGreen,
            Triple(26.5f, 38f, -38f) to brightGreen,
            Triple(33.5f, 37f, -10f) to deepGreen,
            Triple(23f, 33f, -50f) to midGreen,
            Triple(29f, 31f, -28f) to brightGreen
        )
        grains.forEach { (pos, col) ->
            val (gx, gy, deg) = pos
            rotate(degrees = deg, pivot = pt(gx, gy)) {
                drawOval(
                    color = col,
                    topLeft = Offset((gx - 2.5f) * sx, (gy - 4.3f) * sy),
                    size = Size(5f * sx, 8.6f * sy)
                )
            }
        }

        // 2) Center: Corn cob in open green husk leaves
        val silk = Path().apply {
            moveTo(60f * sx, 25f * sy)
            lineTo(56f * sx, 16f * sy)
            moveTo(60f * sx, 25f * sy)
            lineTo(60.5f * sx, 14.5f * sy)
            moveTo(60f * sx, 25f * sy)
            lineTo(65f * sx, 16f * sy)
        }
        drawPath(
            path = silk,
            color = deepGreen,
            style = Stroke(width = (1.8f * sx).coerceAtLeast(1f), cap = StrokeCap.Round)
        )

        val cornCob = Path().apply {
            moveTo(60f * sx, 24f * sy)
            cubicTo(68.5f * sx, 24f * sy, 72.5f * sx, 37f * sy, 71.5f * sx, 60f * sy)
            cubicTo(71f * sx, 74f * sy, 67f * sx, 87f * sy, 60f * sx, 88.5f * sy)
            cubicTo(53f * sx, 87f * sy, 49f * sx, 74f * sy, 48.5f * sx, 60f * sy)
            cubicTo(47.5f * sx, 37f * sy, 51.5f * sx, 24f * sy, 60f * sx, 24f * sy)
            close()
        }
        drawPath(cornCob, color = brightGreen)
        drawPath(
            cornCob,
            color = deepGreen,
            style = Stroke(width = (1.8f * sx).coerceAtLeast(1f), join = StrokeJoin.Round)
        )

        val kernelStroke = (1.1f * sx).coerceAtLeast(0.8f)
        listOf(33f to 54f..66f, 41f to 52f..68f, 49f to 51f..69f, 57f to 51.5f..68.5f, 65f to 52.5f..67.5f)
            .forEach { (yVal, xRange) ->
                drawLine(
                    color = paleMint,
                    start = pt(xRange.start, yVal),
                    end = pt(xRange.endInclusive, yVal),
                    strokeWidth = kernelStroke
                )
            }
        listOf(56f to 27f..73f, 60f to 25f..75f, 64f to 27f..73f).forEach { (xVal, yRange) ->
            drawLine(
                color = paleMint,
                start = pt(xVal, yRange.start),
                end = pt(xVal, yRange.endInclusive),
                strokeWidth = kernelStroke
            )
        }

        val leftHusk = Path().apply {
            moveTo(59.5f * sx, 92f * sy)
            cubicTo(47f * sx, 86f * sy, 40f * sx, 69f * sy, 42.5f * sx, 50f * sy)
            cubicTo(47.5f * sx, 58f * sy, 53f * sx, 71f * sy, 60f * sx, 83f * sy)
            close()
        }
        drawPath(leftHusk, color = deepGreen)

        val rightHusk = Path().apply {
            moveTo(60.5f * sx, 92f * sy)
            cubicTo(73f * sx, 86f * sy, 80f * sx, 69f * sy, 77.5f * sx, 50f * sy)
            cubicTo(72.5f * sx, 58f * sy, 67f * sx, 71f * sy, 60f * sx, 83f * sy)
            close()
        }
        drawPath(rightHusk, color = midGreen)

        drawLine(
            color = deepGreen,
            start = pt(60f, 96f),
            end = pt(60f, 83f),
            strokeWidth = (3.4f * sx).coerceAtLeast(1.5f),
            cap = StrokeCap.Round
        )

        // 3) Right: Tomato / broad-leaf food crop
        val tomatoStem = Path().apply {
            moveTo(84f * sx, 92f * sy)
            cubicTo(84f * sx, 78f * sy, 86f * sx, 66f * sy, 89f * sx, 56f * sy)
        }
        drawPath(
            tomatoStem,
            color = deepGreen,
            style = Stroke(width = (3f * sx).coerceAtLeast(1.4f), cap = StrokeCap.Round)
        )
        val broadLeaf = Path().apply {
            moveTo(86f * sx, 70f * sy)
            cubicTo(94f * sx, 64f * sy, 102f * sx, 55f * sy, 102f * sx, 45f * sy)
            cubicTo(94f * sx, 47f * sy, 87f * sx, 55f * sy, 85f * sx, 64f * sy)
            close()
        }
        drawPath(broadLeaf, color = brightGreen)

        drawCircle(color = midGreen, radius = 11.5f * sx, center = pt(88f, 54f))
        drawCircle(
            color = deepGreen,
            radius = 11.5f * sx,
            center = pt(88f, 54f),
            style = Stroke(width = (1.8f * sx).coerceAtLeast(1f))
        )
        val fruitHighlight = Path().apply {
            moveTo(82f * sx, 50f * sy)
            cubicTo(82.5f * sx, 46.8f * sy, 85.2f * sx, 44.5f * sy, 88.5f * sx, 44.5f * sy)
        }
        drawPath(
            fruitHighlight,
            color = leafHighlight,
            style = Stroke(width = (1.5f * sx).coerceAtLeast(1f), cap = StrokeCap.Round)
        )
        val calyx = Path().apply {
            moveTo(88f * sx, 42.5f * sy)
            lineTo(84f * sx, 37.5f * sy)
            lineTo(86.8f * sx, 40.8f * sy)
            lineTo(88f * sx, 35.8f * sy)
            lineTo(89.2f * sx, 40.8f * sy)
            lineTo(92.4f * sx, 37.5f * sy)
            close()
        }
        drawPath(calyx, color = deepGreen)

        val smallLeaf = Path().apply {
            moveTo(84.5f * sx, 80f * sy)
            cubicTo(77f * sx, 76f * sy, 73.5f * sx, 70f * sy, 73f * sx, 64.5f * sy)
            cubicTo(79.5f * sx, 66.8f * sy, 83f * sx, 72.8f * sy, 84.5f * sx, 79f * sy)
            close()
        }
        drawPath(smallLeaf, color = midGreen)
    }
}

@Composable
fun CropAnalyzerWordmarkText(
    fontSize: TextUnit = 19.sp
) {
    Text(
        text = buildAnnotatedString {
            withStyle(SpanStyle(color = Color(0xFF1B5E20), fontWeight = FontWeight.Bold)) {
                append("Crop")
            }
            withStyle(SpanStyle(color = Color(0xFF111812), fontWeight = FontWeight.Bold)) {
                append("Analyzer")
            }
        },
        fontSize = fontSize
    )
}

@Composable
fun CropAnalyzerLogoLockup(
    modifier: Modifier = Modifier,
    stacked: Boolean = true,
    iconSize: Dp = 62.dp,
    fontSize: TextUnit = 18.sp
) {
    if (stacked) {
        Column(
            modifier = modifier,
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            ThreeCropWhiteCircleIcon(size = iconSize)
            CropAnalyzerWordmarkText(fontSize = fontSize)
        }
    } else {
        Row(
            modifier = modifier,
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ThreeCropWhiteCircleIcon(size = iconSize)
            CropAnalyzerWordmarkText(fontSize = fontSize)
        }
    }
}
