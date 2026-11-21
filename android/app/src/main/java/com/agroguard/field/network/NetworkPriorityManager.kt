package com.agroguard.field.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class TransportType {
    WIFI,
    TELCO_CELLULAR,
    NONE
}

data class PriorityNetworkState(
    val isAvailable: Boolean,
    val preferredTransport: TransportType,
    val wifiNetwork: Network? = null,
    val cellularNetwork: Network? = null
) {
    /** Always prioritizes Wi-Fi first; uses Telco Cellular only if Wi-Fi is unavailable. */
    val prioritizedNetwork: Network?
        get() = wifiNetwork ?: cellularNetwork

    val humanReadableSignal: String
        get() = when (preferredTransport) {
            TransportType.WIFI -> "Using Free Wi-Fi First"
            TransportType.TELCO_CELLULAR -> "Using Mobile Data (Wi-Fi not available)"
            TransportType.NONE -> "No Wi-Fi or Mobile Signal (Offline)"
        }
}

/**
 * Monitors both Wi-Fi and Telco Cellular connectivity independently so the app
 * explicitly prioritizes Wi-Fi first and falls back to Telco only if Wi-Fi is absent.
 */
class NetworkPriorityManager(context: Context) {

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val activeWifiNetworks = mutableSetOf<Network>()
    private val activeCellularNetworks = mutableSetOf<Network>()

    private val _state = MutableStateFlow(evaluateCurrentNetworks())
    val state: StateFlow<PriorityNetworkState> = _state.asStateFlow()

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            updateNetworkSet(network, add = true)
        }

        override fun onLost(network: Network) {
            updateNetworkSet(network, add = false)
        }

        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
            updateNetworkSet(network, add = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))
        }
    }

    fun startListening() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
            .build()
        connectivityManager.registerNetworkCallback(request, networkCallback)
        _state.value = evaluateCurrentNetworks()
    }

    fun stopListening() {
        runCatching { connectivityManager.unregisterNetworkCallback(networkCallback) }
    }

    @Synchronized
    private fun updateNetworkSet(network: Network, add: Boolean) {
        val caps = connectivityManager.getNetworkCapabilities(network)
        if (add && caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                activeWifiNetworks.add(network)
            } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                activeCellularNetworks.add(network)
            }
        } else {
            activeWifiNetworks.remove(network)
            activeCellularNetworks.remove(network)
        }
        _state.value = buildPriorityState()
    }

    private fun evaluateCurrentNetworks(): PriorityNetworkState {
        val active = connectivityManager.activeNetwork
        val caps = active?.let { connectivityManager.getNetworkCapabilities(it) }
        if (active != null && caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                activeWifiNetworks.add(active)
            } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                activeCellularNetworks.add(active)
            }
        }
        return buildPriorityState()
    }

    private fun buildPriorityState(): PriorityNetworkState {
        val wifi = activeWifiNetworks.firstOrNull()
        val telco = activeCellularNetworks.firstOrNull()
        return when {
            wifi != null -> PriorityNetworkState(true, TransportType.WIFI, wifi, telco)
            telco != null -> PriorityNetworkState(true, TransportType.TELCO_CELLULAR, null, telco)
            else -> PriorityNetworkState(false, TransportType.NONE, null, null)
        }
    }
}
