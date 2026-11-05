import sys
import json
import urllib.request
import os

API_KEY = os.environ.get("REFUSELESS_API_KEY", "abl_fd4d22704c3da0510e02d83f9cdc1b87fcf640b9e9533a35")
BASE_URL = os.environ.get("REFUSELESS_BASE_URL", "https://api.refuseless.com/v1").rstrip("/")
DEFAULT_MODEL = "deepseek-v4.1-flash-abliterated-free"

def stream_chat(messages, model=DEFAULT_MODEL):
    url = f"{BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": messages,
        "stream": True
    }
    
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
    full_response = []
    
    try:
        with urllib.request.urlopen(req) as response:
            for line in response:
                decoded = line.decode("utf-8").strip()
                if not decoded or not decoded.startswith("data: "):
                    continue
                data_part = decoded[6:]
                if data_part == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_part)
                    delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if delta:
                        print(delta, end="", flush=True)
                        full_response.append(delta)
                except Exception:
                    pass
        print()
        return "".join(full_response)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        print(f"\n[API Error {e.code}]: {err_msg}")
        return None
    except Exception as e:
        print(f"\n[Error]: {e}")
        return None

def main():
    # One-shot mode: if argument passed directly
    if len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
        stream_chat([{"role": "user", "content": prompt}])
        return

    # Interactive mode
    print("=" * 60)
    print(" 🔥 REFUSELESS TERMINAL CHAT")
    print(f" Model: {DEFAULT_MODEL}")
    print(" Commands: 'exit'/'quit' to leave, 'clear' to reset chat")
    print("=" * 60)
    
    history = []
    current_model = DEFAULT_MODEL
    
    while True:
        try:
            user_input = input("\n👉 You: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ("exit", "quit", "q"):
                print("Exiting. Bye!")
                break
            if user_input.lower() == "clear":
                history = []
                print("[Chat history cleared]")
                continue
            if user_input.lower().startswith("/model "):
                current_model = user_input.split(" ", 1)[1].strip()
                print(f"[Model switched to: {current_model}]")
                continue
                
            history.append({"role": "user", "content": user_input})
            print("\n🤖 AI: ", end="", flush=True)
            
            ai_reply = stream_chat(history, model=current_model)
            if ai_reply:
                history.append({"role": "assistant", "content": ai_reply})
            else:
                # Remove last user prompt if API failed
                history.pop()
        except KeyboardInterrupt:
            print("\nExiting. Bye!")
            break

if __name__ == "__main__":
    main()
