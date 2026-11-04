package com.tourney.core.firebase

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider

/**
 * Google Sign-In Manager for instant 1-tap player authentication.
 */
object GoogleAuthManager {

    /** Default Web Client ID from google-services.json (client_type 3). */
    const val DEFAULT_WEB_CLIENT_ID = "116392399100-uhb1o4qpjrunqur7s5d3fd1a31sf4k7s.apps.googleusercontent.com"

    fun getSignInClient(context: Context, webClientId: String = DEFAULT_WEB_CLIENT_ID): GoogleSignInClient {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(webClientId)
            .requestEmail()
            .requestProfile()
            .build()
        return GoogleSignIn.getClient(context, gso)
    }

    /**
     * Exchanges GoogleSignInAccount tokens with Firebase Auth to obtain a verified Firebase ID Token.
     */
    fun firebaseAuthWithGoogle(
        account: GoogleSignInAccount,
        onSuccess: (idToken: String, email: String, name: String) -> Unit,
        onError: (errorMessage: String) -> Unit,
    ) {
        val googleToken = account.idToken
        if (googleToken.isNullOrBlank()) {
            onError("Unable to retrieve Google token from selected account.")
            return
        }

        val credential = GoogleAuthProvider.getCredential(googleToken, null)
        val auth = FirebaseAuth.getInstance()

        auth.signInWithCredential(credential)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val firebaseUser = auth.currentUser
                    if (firebaseUser != null) {
                        firebaseUser.getIdToken(false).addOnCompleteListener { tokenTask ->
                            if (tokenTask.isSuccessful) {
                                val idToken = tokenTask.result?.token
                                if (!idToken.isNullOrBlank()) {
                                    val email = firebaseUser.email ?: account.email ?: ""
                                    val name = firebaseUser.displayName ?: account.displayName ?: ""
                                    onSuccess(idToken, email, name)
                                } else {
                                    onError("Failed to obtain Firebase session token.")
                                }
                            } else {
                                onError(tokenTask.exception?.localizedMessage ?: "Token retrieval failed.")
                            }
                        }
                    } else {
                        onError("Firebase user is null after sign-in.")
                    }
                } else {
                    onError(task.exception?.localizedMessage ?: "Google authentication with Firebase failed.")
                }
            }
    }
}
