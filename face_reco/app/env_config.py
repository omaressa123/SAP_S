import os
import sys
import io

# Fix for UnicodeEncodeError on Windows when DeepFace prints emojis
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 1. DeepFace requires legacy Keras (Keras 2) to avoid KerasTensor issues in Keras 3
os.environ["TF_USE_LEGACY_KERAS"] = "1"

# 2. Force CPU execution to avoid broken GPU JIT/libdevice/cuInit errors
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

# 3. Disable XLA JIT compilation
os.environ["TF_XLA_FLAGS"] = "--tf_xla_auto_jit=-1"

# 4. Silence oneDNN custom operations warning
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# 5. Suppress TensorFlow logging noise (0=all, 1=no INFO, 2=no INFO/WARN, 3=no INFO/WARN/ERROR)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

# Optional: Force TensorFlow to use specific threading if needed
# os.environ["OMP_NUM_THREADS"] = "1"

def setup_tf():
    """Apply runtime TensorFlow configurations."""
    try:
        import tensorflow as tf
        # Disable JIT globally at runtime as an extra safeguard
        tf.config.optimizer.set_jit(False)
        
        # Verify CPU-only (optional, but good for debugging)
        cpus = tf.config.list_physical_devices('CPU')
        gpus = tf.config.list_physical_devices('GPU')
        if not gpus:
            # We are successfully in CPU-only mode
            pass
    except ImportError:
        pass
