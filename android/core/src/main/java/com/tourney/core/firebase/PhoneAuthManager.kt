package com.tourney.core.firebase

import android.app.Activity
import com.google.firebase.FirebaseException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import java.util.concurrent.TimeUnit

/**
 * State callbacks for Firebase Phone + OTP Authentication.
 */
interface PhoneAuthListener {
    /** Called when SMS OTP has been sent by Firebase to the mobile phone. */
    fun onCodeSent(verificationId: String, resendToken: PhoneAuthProvider.ForceResendingToken)

    /** Called on instant auto-verification (e.g. SMS Retriever API on real device). */
    fun onAutoVerified(idToken: String)

    /** Called when an error occurs during phone verification or OTP sending. */
    fun onError(errorMessage: String)

    /** Called when OTP verification completes and Firebase ID token is retrieved. */
    fun onVerificationSuccess(idToken: String)
}

/**
 * Robust Firebase Phone + OTP Manager.
 * Handles phone formatting (+91 E.164), SMS OTP dispatch, auto-retrieval,
 * credential verification and Firebase ID token generation for backend sync.
 */
object PhoneAuthManager {

    private val auth: FirebaseAuth get() = FirebaseAuth.getInstance()

    /**
     * Normalizes an Indian or international phone number to E.164 format.
     * E.g. '9999900003' -> '+919999900003'.
     */
    fun formatToE164(phone: String, defaultCountryCode: String = "+91"): String {
        val trimmed = phone.trim().replace(" ", "").replace("-", "")
        return when {
            trimmed.startsWith("+") -> trimmed
            trimmed.length == 10 -> "$defaultCountryCode$trimmed"
            trimmed.startsWith("91") && trimmed.length == 12 -> "+$trimmed"
            else -> "$defaultCountryCode$trimmed"
        }
    }

    /**
     * Sends an SMS OTP to the specified phone number via Firebase PhoneAuthProvider.
     */
    fun sendOtp(
        activity: Activity,
        phoneNumber: String,
        listener: PhoneAuthListener,
        resendToken: PhoneAuthProvider.ForceResendingToken? = null,
    ) {
        val formatted = formatToE164(phoneNumber)

        val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
            override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                // Instant auto-verification (Play Integrity / SMS Retriever)
                signInWithCredential(credential, listener, isAuto = true)
            }

            override fun onVerificationFailed(e: FirebaseException) {
                val errorMsg = when (e) {
                    is FirebaseAuthInvalidCredentialsException -> "Invalid phone number or verification code."
                    is FirebaseTooManyRequestsException -> "SMS quota or rate limit exceeded. Please try again later."
                    else -> e.localizedMessage ?: "Phone verification failed (${e.message})."
                }
                listener.onError(errorMsg)
            }

            override fun onCodeSent(
                verificationId: String,
                token: PhoneAuthProvider.ForceResendingToken,
            ) {
                listener.onCodeSent(verificationId, token)
            }
        }

        val builder = PhoneAuthOptions.newBuilder(auth)
            .setPhoneNumber(formatted)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(activity)
            .setCallbacks(callbacks)

        if (resendToken != null) {
            builder.setForceResendingToken(resendToken)
        }

        PhoneAuthProvider.verifyPhoneNumber(builder.build())
    }

    /**
     * Verifies the 6-digit OTP code entered by the user.
     */
    fun verifyOtp(
        verificationId: String,
        otpCode: String,
        listener: PhoneAuthListener,
    ) {
        if (otpCode.trim().length != 6) {
            listener.onError("Please enter a valid 6-digit OTP.")
            return
        }

        try {
            val credential = PhoneAuthProvider.getCredential(verificationId, otpCode.trim())
            signInWithCredential(credential, listener, isAuto = false)
        } catch (e: Exception) {
            listener.onError(e.localizedMessage ?: "Failed to verify OTP code.")
        }
    }

    private fun signInWithCredential(
        credential: PhoneAuthCredential,
        listener: PhoneAuthListener,
        isAuto: Boolean,
    ) {
        auth.signInWithCredential(credential)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val user = auth.currentUser
                    if (user != null) {
                        user.getIdToken(false).addOnCompleteListener { tokenTask ->
                            if (tokenTask.isSuccessful) {
                                val idToken = tokenTask.result?.token
                                if (!idToken.isNullOrBlank()) {
                                    if (isAuto) {
                                        listener.onAutoVerified(idToken)
                                    } else {
                                        listener.onVerificationSuccess(idToken)
                                    }
                                } else {
                                    listener.onError("Unable to retrieve Firebase session token.")
                                }
                            } else {
                                listener.onError(
                                    tokenTask.exception?.localizedMessage
                                        ?: "Failed to obtain verification token.",
                                )
                            }
                        }
                    } else {
                        listener.onError("Firebase user is null after sign in.")
                    }
                } else {
                    val ex = task.exception
                    val errorMsg = when (ex) {
                        is FirebaseAuthInvalidCredentialsException -> "Incorrect OTP entered. Please check and retry."
                        else -> ex?.localizedMessage ?: "Sign in with OTP failed."
                    }
                    listener.onError(errorMsg)
                }
            }
    }
}
