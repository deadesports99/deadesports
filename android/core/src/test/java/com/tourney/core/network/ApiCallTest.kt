package com.tourney.core.network

import com.tourney.core.model.ApiEnvelope
import com.tourney.core.model.ApiException
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

/**
 * `apiCall` is the single door between every ViewModel and the backend, so a
 * wrong mapping here shows up as a wrong message (or a silent success) in the
 * money flow. These tests pin the envelope contract.
 */
class ApiCallTest {

    @Test
    fun `returns the payload of a successful envelope`() = runTest {
        val value = apiCall { ApiEnvelope(success = true, message = "ok", data = "BALANCE", statusCode = 200) }
        assertEquals("BALANCE", value)
    }

    @Test
    fun `a success envelope without data is an error, not a silent null`() = runTest {
        try {
            apiCall<String> { ApiEnvelope(success = false, message = "Wallet not found", data = null, statusCode = 404) }
            fail("expected ApiException")
        } catch (e: ApiException) {
            assertEquals(404, e.statusCode)
            assertEquals("Wallet not found", e.message)
        }
    }

    @Test
    fun `http error envelope becomes an ApiException with parsed details`() = runTest {
        val body = """
            {"success":false,"message":"Room credentials unlock in 12 min","statusCode":403,
             "data":{"secondsUntilReveal":720}}
        """.trimIndent()

        try {
            apiCall<String> { throw httpException(403, body) }
            fail("expected ApiException")
        } catch (e: ApiException) {
            assertEquals(403, e.statusCode)
            assertEquals("Room credentials unlock in 12 min", e.message)
            assertEquals(720L, e.secondsUntilReveal())
        }
    }

    @Test
    fun `http error without a json body falls back to a readable message`() = runTest {
        try {
            apiCall<String> { throw httpException(502, "<html>bad gateway</html>") }
            fail("expected ApiException")
        } catch (e: ApiException) {
            assertEquals(502, e.statusCode)
            assertEquals("Server error (502)", e.message)
            assertNull(e.secondsUntilReveal())
        }
    }

    @Test
    fun `http error with empty body never crashes the client`() = runTest {
        try {
            apiCall<String> { throw httpException(500, "") }
            fail("expected ApiException")
        } catch (e: ApiException) {
            assertEquals(500, e.statusCode)
            assertTrue(e.details.isEmpty())
        }
    }

    @Test
    fun `fine-grained validation details survive the mapping`() = runTest {
        val body = """
            {"success":false,"message":"Invalid input","statusCode":400,
             "data":{"utr":"UTR must be 12 digits"}}
        """.trimIndent()

        try {
            apiCall<String> { throw httpException(400, body) }
            fail("expected ApiException")
        } catch (e: ApiException) {
            assertEquals("UTR must be 12 digits", e.details["utr"])
        }
    }

    private fun httpException(code: Int, body: String): HttpException {
        val response = Response.error<Any>(code, body.toResponseBody("application/json".toMediaType()))
        return HttpException(response)
    }
}
