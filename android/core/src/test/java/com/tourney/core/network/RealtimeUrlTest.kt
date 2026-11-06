package com.tourney.core.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RealtimeUrlTest {

    @Test
    fun `https api becomes wss at the host root`() {
        assertEquals(
            "wss://api.thunderesports.in/ws?tenantId=t1",
            RealtimeUrl.build("https://api.thunderesports.in/api/v1", "t1"),
        )
    }

    @Test
    fun `local http becomes ws and keeps the port`() {
        assertEquals(
            "ws://localhost:5000/ws?tenantId=t1",
            RealtimeUrl.build("http://localhost:5000/api/v1/", "t1"),
        )
    }

    @Test
    fun `token is appended only when present`() {
        assertEquals(
            "wss://api.x.in/ws?tenantId=t1&token=abc",
            RealtimeUrl.build("https://api.x.in/api/v1", "t1", "abc"),
        )
        assertEquals(
            "wss://api.x.in/ws?tenantId=t1",
            RealtimeUrl.build("https://api.x.in/api/v1", "t1", "   "),
        )
    }

    @Test
    fun `a missing or unusable base url never builds a localhost guess`() {
        assertNull(RealtimeUrl.build(null, "t1"))
        assertNull(RealtimeUrl.build("", "t1"))
        assertNull(RealtimeUrl.build("   ", "t1"))
        assertNull("scheme is required", RealtimeUrl.build("api.x.in/api/v1", "t1"))
    }
}
