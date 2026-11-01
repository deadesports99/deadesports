# Core module R8 rules — keep Moshi reflectively-created models.
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*
-keepclassmembers class ** {
    @com.squareup.moshi.FromJson <methods>;
    @com.squareup.moshi.ToJson <methods>;
}
-keep class com.tourney.core.model.** { *; }