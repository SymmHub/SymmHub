/* Generated from Java with JSweet 2.0.0 - http://www.jsweet.org */
var Jama;
(function (Jama) {
    /**
     * Construct the singular value decomposition
     * Structure to access U, S and V.
     * @param {Jama.Matrix} Arg    Rectangular matrix
     * @class
     */
    var SingularValueDecomposition = (function () {
        function SingularValueDecomposition(Arg) {
            this.U = null;
            this.V = null;
            this.s = null;
            this.m = 0;
            this.n = 0;
            var A = Arg.getArrayCopy();
            this.m = Arg.getRowDimension();
            this.n = Arg.getColumnDimension();
            var nu = Math.min(this.m, this.n);
            this.s = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(Math.min(this.m + 1, this.n));
            this.U = (function (dims) { var allocate = function (dims) { if (dims.length == 0) {
                return 0;
            }
            else {
                var array = [];
                for (var i = 0; i < dims[0]; i++) {
                    array.push(allocate(dims.slice(1)));
                }
                return array;
            } }; return allocate(dims); })([this.m, nu]);
            this.V = (function (dims) { var allocate = function (dims) { if (dims.length == 0) {
                return 0;
            }
            else {
                var array = [];
                for (var i = 0; i < dims[0]; i++) {
                    array.push(allocate(dims.slice(1)));
                }
                return array;
            } }; return allocate(dims); })([this.n, this.n]);
            var e = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.n);
            var work = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.m);
            var wantu = true;
            var wantv = true;
            var nct = Math.min(this.m - 1, this.n);
            var nrt = Math.max(0, Math.min(this.n - 2, this.m));
            for (var k = 0; k < Math.max(nct, nrt); k++) {
                if (k < nct) {
                    this.s[k] = 0;
                    for (var i = k; i < this.m; i++) {
                        this.s[k] = Jama.util.Maths.hypot(this.s[k], A[i][k]);
                    }
                    ;
                    if (this.s[k] !== 0.0) {
                        if (A[k][k] < 0.0) {
                            this.s[k] = -this.s[k];
                        }
                        for (var i = k; i < this.m; i++) {
                            A[i][k] /= this.s[k];
                        }
                        ;
                        A[k][k] += 1.0;
                    }
                    this.s[k] = -this.s[k];
                }
                for (var j = k + 1; j < this.n; j++) {
                    if ((function (lhs, rhs) { return lhs && rhs; })((k < nct), (this.s[k] !== 0.0))) {
                        var t = 0;
                        for (var i = k; i < this.m; i++) {
                            t += A[i][k] * A[i][j];
                        }
                        ;
                        t = -t / A[k][k];
                        for (var i = k; i < this.m; i++) {
                            A[i][j] += t * A[i][k];
                        }
                        ;
                    }
                    e[j] = A[k][j];
                }
                ;
                if ((function (lhs, rhs) { return lhs && rhs; })(wantu, (k < nct))) {
                    for (var i = k; i < this.m; i++) {
                        this.U[i][k] = A[i][k];
                    }
                    ;
                }
                if (k < nrt) {
                    e[k] = 0;
                    for (var i = k + 1; i < this.n; i++) {
                        e[k] = Jama.util.Maths.hypot(e[k], e[i]);
                    }
                    ;
                    if (e[k] !== 0.0) {
                        if (e[k + 1] < 0.0) {
                            e[k] = -e[k];
                        }
                        for (var i = k + 1; i < this.n; i++) {
                            e[i] /= e[k];
                        }
                        ;
                        e[k + 1] += 1.0;
                    }
                    e[k] = -e[k];
                    if ((function (lhs, rhs) { return lhs && rhs; })((k + 1 < this.m), (e[k] !== 0.0))) {
                        for (var i = k + 1; i < this.m; i++) {
                            work[i] = 0.0;
                        }
                        ;
                        for (var j = k + 1; j < this.n; j++) {
                            for (var i = k + 1; i < this.m; i++) {
                                work[i] += e[j] * A[i][j];
                            }
                            ;
                        }
                        ;
                        for (var j = k + 1; j < this.n; j++) {
                            var t = -e[j] / e[k + 1];
                            for (var i = k + 1; i < this.m; i++) {
                                A[i][j] += t * work[i];
                            }
                            ;
                        }
                        ;
                    }
                    if (wantv) {
                        for (var i = k + 1; i < this.n; i++) {
                            this.V[i][k] = e[i];
                        }
                        ;
                    }
                }
            }
            ;
            var p = Math.min(this.n, this.m + 1);
            if (nct < this.n) {
                this.s[nct] = A[nct][nct];
            }
            if (this.m < p) {
                this.s[p - 1] = 0.0;
            }
            if (nrt + 1 < p) {
                e[nrt] = A[nrt][p - 1];
            }
            e[p - 1] = 0.0;
            if (wantu) {
                for (var j = nct; j < nu; j++) {
                    for (var i = 0; i < this.m; i++) {
                        this.U[i][j] = 0.0;
                    }
                    ;
                    this.U[j][j] = 1.0;
                }
                ;
                for (var k = nct - 1; k >= 0; k--) {
                    if (this.s[k] !== 0.0) {
                        for (var j = k + 1; j < nu; j++) {
                            var t = 0;
                            for (var i = k; i < this.m; i++) {
                                t += this.U[i][k] * this.U[i][j];
                            }
                            ;
                            t = -t / this.U[k][k];
                            for (var i = k; i < this.m; i++) {
                                this.U[i][j] += t * this.U[i][k];
                            }
                            ;
                        }
                        ;
                        for (var i = k; i < this.m; i++) {
                            this.U[i][k] = -this.U[i][k];
                        }
                        ;
                        this.U[k][k] = 1.0 + this.U[k][k];
                        for (var i = 0; i < k - 1; i++) {
                            this.U[i][k] = 0.0;
                        }
                        ;
                    }
                    else {
                        for (var i = 0; i < this.m; i++) {
                            this.U[i][k] = 0.0;
                        }
                        ;
                        this.U[k][k] = 1.0;
                    }
                }
                ;
            }
            if (wantv) {
                for (var k = this.n - 1; k >= 0; k--) {
                    if ((function (lhs, rhs) { return lhs && rhs; })((k < nrt), (e[k] !== 0.0))) {
                        for (var j = k + 1; j < nu; j++) {
                            var t = 0;
                            for (var i = k + 1; i < this.n; i++) {
                                t += this.V[i][k] * this.V[i][j];
                            }
                            ;
                            t = -t / this.V[k + 1][k];
                            for (var i = k + 1; i < this.n; i++) {
                                this.V[i][j] += t * this.V[i][k];
                            }
                            ;
                        }
                        ;
                    }
                    for (var i = 0; i < this.n; i++) {
                        this.V[i][k] = 0.0;
                    }
                    ;
                    this.V[k][k] = 1.0;
                }
                ;
            }
            var pp = p - 1;
            var iter = 0;
            var eps = Math.pow(2.0, -52.0);
            var tiny = Math.pow(2.0, -966.0);
            while ((p > 0)) {
                var k = void 0;
                var kase = void 0;
                for (k = p - 2; k >= -1; k--) {
                    if (k === -1) {
                        break;
                    }
                    if (Math.abs(e[k]) <= tiny + eps * (Math.abs(this.s[k]) + Math.abs(this.s[k + 1]))) {
                        e[k] = 0.0;
                        break;
                    }
                }
                ;
                if (k === p - 2) {
                    kase = 4;
                }
                else {
                    var ks = void 0;
                    for (ks = p - 1; ks >= k; ks--) {
                        if (ks === k) {
                            break;
                        }
                        var t = (ks !== p ? Math.abs(e[ks]) : 0.0) + (ks !== k + 1 ? Math.abs(e[ks - 1]) : 0.0);
                        if (Math.abs(this.s[ks]) <= tiny + eps * t) {
                            this.s[ks] = 0.0;
                            break;
                        }
                    }
                    ;
                    if (ks === k) {
                        kase = 3;
                    }
                    else if (ks === p - 1) {
                        kase = 1;
                    }
                    else {
                        kase = 2;
                        k = ks;
                    }
                }
                k++;
                switch ((kase)) {
                    case 1:
                        {
                            var f = e[p - 2];
                            e[p - 2] = 0.0;
                            for (var j = p - 2; j >= k; j--) {
                                var t = Jama.util.Maths.hypot(this.s[j], f);
                                var cs = this.s[j] / t;
                                var sn = f / t;
                                this.s[j] = t;
                                if (j !== k) {
                                    f = -sn * e[j - 1];
                                    e[j - 1] = cs * e[j - 1];
                                }
                                if (wantv) {
                                    for (var i = 0; i < this.n; i++) {
                                        t = cs * this.V[i][j] + sn * this.V[i][p - 1];
                                        this.V[i][p - 1] = -sn * this.V[i][j] + cs * this.V[i][p - 1];
                                        this.V[i][j] = t;
                                    }
                                    ;
                                }
                            }
                            ;
                        }
                        ;
                        break;
                    case 2:
                        {
                            var f = e[k - 1];
                            e[k - 1] = 0.0;
                            for (var j = k; j < p; j++) {
                                var t = Jama.util.Maths.hypot(this.s[j], f);
                                var cs = this.s[j] / t;
                                var sn = f / t;
                                this.s[j] = t;
                                f = -sn * e[j];
                                e[j] = cs * e[j];
                                if (wantu) {
                                    for (var i = 0; i < this.m; i++) {
                                        t = cs * this.U[i][j] + sn * this.U[i][k - 1];
                                        this.U[i][k - 1] = -sn * this.U[i][j] + cs * this.U[i][k - 1];
                                        this.U[i][j] = t;
                                    }
                                    ;
                                }
                            }
                            ;
                        }
                        ;
                        break;
                    case 3:
                        {
                            var scale = Math.max(Math.max(Math.max(Math.max(Math.abs(this.s[p - 1]), Math.abs(this.s[p - 2])), Math.abs(e[p - 2])), Math.abs(this.s[k])), Math.abs(e[k]));
                            var sp = this.s[p - 1] / scale;
                            var spm1 = this.s[p - 2] / scale;
                            var epm1 = e[p - 2] / scale;
                            var sk = this.s[k] / scale;
                            var ek = e[k] / scale;
                            var b = ((spm1 + sp) * (spm1 - sp) + epm1 * epm1) / 2.0;
                            var c = (sp * epm1) * (sp * epm1);
                            var shift = 0.0;
                            if ((function (lhs, rhs) { return lhs || rhs; })((b !== 0.0), (c !== 0.0))) {
                                shift = Math.sqrt(b * b + c);
                                if (b < 0.0) {
                                    shift = -shift;
                                }
                                shift = c / (b + shift);
                            }
                            var f = (sk + sp) * (sk - sp) + shift;
                            var g = sk * ek;
                            for (var j = k; j < p - 1; j++) {
                                var t = Jama.util.Maths.hypot(f, g);
                                var cs = f / t;
                                var sn = g / t;
                                if (j !== k) {
                                    e[j - 1] = t;
                                }
                                f = cs * this.s[j] + sn * e[j];
                                e[j] = cs * e[j] - sn * this.s[j];
                                g = sn * this.s[j + 1];
                                this.s[j + 1] = cs * this.s[j + 1];
                                if (wantv) {
                                    for (var i = 0; i < this.n; i++) {
                                        t = cs * this.V[i][j] + sn * this.V[i][j + 1];
                                        this.V[i][j + 1] = -sn * this.V[i][j] + cs * this.V[i][j + 1];
                                        this.V[i][j] = t;
                                    }
                                    ;
                                }
                                t = Jama.util.Maths.hypot(f, g);
                                cs = f / t;
                                sn = g / t;
                                this.s[j] = t;
                                f = cs * e[j] + sn * this.s[j + 1];
                                this.s[j + 1] = -sn * e[j] + cs * this.s[j + 1];
                                g = sn * e[j + 1];
                                e[j + 1] = cs * e[j + 1];
                                if (wantu && (j < this.m - 1)) {
                                    for (var i = 0; i < this.m; i++) {
                                        t = cs * this.U[i][j] + sn * this.U[i][j + 1];
                                        this.U[i][j + 1] = -sn * this.U[i][j] + cs * this.U[i][j + 1];
                                        this.U[i][j] = t;
                                    }
                                    ;
                                }
                            }
                            ;
                            e[p - 2] = f;
                            iter = iter + 1;
                        }
                        ;
                        break;
                    case 4:
                        {
                            if (this.s[k] <= 0.0) {
                                this.s[k] = (this.s[k] < 0.0 ? -this.s[k] : 0.0);
                                if (wantv) {
                                    for (var i = 0; i <= pp; i++) {
                                        this.V[i][k] = -this.V[i][k];
                                    }
                                    ;
                                }
                            }
                            while ((k < pp)) {
                                if (this.s[k] >= this.s[k + 1]) {
                                    break;
                                }
                                var t = this.s[k];
                                this.s[k] = this.s[k + 1];
                                this.s[k + 1] = t;
                                if (wantv && (k < this.n - 1)) {
                                    for (var i = 0; i < this.n; i++) {
                                        t = this.V[i][k + 1];
                                        this.V[i][k + 1] = this.V[i][k];
                                        this.V[i][k] = t;
                                    }
                                    ;
                                }
                                if (wantu && (k < this.m - 1)) {
                                    for (var i = 0; i < this.m; i++) {
                                        t = this.U[i][k + 1];
                                        this.U[i][k + 1] = this.U[i][k];
                                        this.U[i][k] = t;
                                    }
                                    ;
                                }
                                k++;
                            }
                            ;
                            iter = 0;
                            p--;
                        }
                        ;
                        break;
                }
            }
            ;
        }
        /**
         * Return the left singular vectors
         * @return     {Jama.Matrix} U
         */
        SingularValueDecomposition.prototype.getU = function () {
            return new Jama.Matrix(this.U, this.m, Math.min(this.m + 1, this.n));
        };
        /**
         * Return the right singular vectors
         * @return     {Jama.Matrix} V
         */
        SingularValueDecomposition.prototype.getV = function () {
            return new Jama.Matrix(this.V, this.n, this.n);
        };
        /**
         * Return the one-dimensional array of singular values
         * @return     {Array} diagonal of S.
         */
        SingularValueDecomposition.prototype.getSingularValues = function () {
            return this.s;
        };
        /**
         * Return the diagonal matrix of singular values
         * @return     {Jama.Matrix} S
         */
        SingularValueDecomposition.prototype.getS = function () {
            var X = new Jama.Matrix(this.n, this.n);
            var S = X.getArray();
            for (var i = 0; i < this.n; i++) {
                for (var j = 0; j < this.n; j++) {
                    S[i][j] = 0.0;
                }
                ;
                S[i][i] = this.s[i];
            }
            ;
            return X;
        };
        /**
         * Two norm
         * @return     {number} max(S)
         */
        SingularValueDecomposition.prototype.norm2 = function () {
            return this.s[0];
        };
        /**
         * Two norm condition number
         * @return     {number} max(S)/min(S)
         */
        SingularValueDecomposition.prototype.cond = function () {
            return this.s[0] / this.s[Math.min(this.m, this.n) - 1];
        };
        /**
         * Effective numerical matrix rank
         * @return     {number} Number of nonnegligible singular values.
         */
        SingularValueDecomposition.prototype.rank = function () {
            var eps = Math.pow(2.0, -52.0);
            var tol = Math.max(this.m, this.n) * this.s[0] * eps;
            var r = 0;
            for (var i = 0; i < this.s.length; i++) {
                if (this.s[i] > tol) {
                    r++;
                }
            }
            ;
            return r;
        };
        return SingularValueDecomposition;
    }());
    SingularValueDecomposition.serialVersionUID = 1;
    Jama.SingularValueDecomposition = SingularValueDecomposition;
    SingularValueDecomposition["__class"] = "Jama.SingularValueDecomposition";
    SingularValueDecomposition["__interfaces"] = ["java.io.Serializable"];
})(Jama || (Jama = {}));
(function (Jama) {
    /**
     * Check for symmetry, then construct the eigenvalue decomposition
     * Structure to access D and V.
     * @param {Jama.Matrix} Arg    Square matrix
     * @class
     */
    var EigenvalueDecomposition = (function () {
        function EigenvalueDecomposition(Arg) {
            this.n = 0;
            this.issymmetric = false;
            this.d = null;
            this.e = null;
            this.V = null;
            this.H = null;
            this.ort = null;
            this.cdivr = 0;
            this.cdivi = 0;
            var A = Arg.getArray();
            this.n = Arg.getColumnDimension();
            this.V = (function (dims) { var allocate = function (dims) { if (dims.length == 0) {
                return 0;
            }
            else {
                var array = [];
                for (var i = 0; i < dims[0]; i++) {
                    array.push(allocate(dims.slice(1)));
                }
                return array;
            } }; return allocate(dims); })([this.n, this.n]);
            this.d = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.n);
            this.e = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.n);
            this.issymmetric = true;
            for (var j = 0; (function (lhs, rhs) { return lhs && rhs; })((j < this.n), this.issymmetric); j++) {
                for (var i = 0; (function (lhs, rhs) { return lhs && rhs; })((i < this.n), this.issymmetric); i++) {
                    this.issymmetric = (A[i][j] === A[j][i]);
                }
                ;
            }
            ;
            if (this.issymmetric) {
                for (var i = 0; i < this.n; i++) {
                    for (var j = 0; j < this.n; j++) {
                        this.V[i][j] = A[i][j];
                    }
                    ;
                }
                ;
                this.tred2();
                this.tql2();
            }
            else {
                this.H = (function (dims) { var allocate = function (dims) { if (dims.length == 0) {
                    return 0;
                }
                else {
                    var array = [];
                    for (var i = 0; i < dims[0]; i++) {
                        array.push(allocate(dims.slice(1)));
                    }
                    return array;
                } }; return allocate(dims); })([this.n, this.n]);
                this.ort = (function (s) { var a = []; while (s-- > 0)
                    a.push(0); return a; })(this.n);
                for (var j = 0; j < this.n; j++) {
                    for (var i = 0; i < this.n; i++) {
                        this.H[i][j] = A[i][j];
                    }
                    ;
                }
                ;
                this.orthes();
                this.hqr2();
            }
        }
        /*private*/ EigenvalueDecomposition.prototype.tred2 = function () {
            for (var j = 0; j < this.n; j++) {
                this.d[j] = this.V[this.n - 1][j];
            }
            ;
            for (var i = this.n - 1; i > 0; i--) {
                var scale = 0.0;
                var h = 0.0;
                for (var k = 0; k < i; k++) {
                    scale = scale + Math.abs(this.d[k]);
                }
                ;
                if (scale === 0.0) {
                    this.e[i] = this.d[i - 1];
                    for (var j = 0; j < i; j++) {
                        this.d[j] = this.V[i - 1][j];
                        this.V[i][j] = 0.0;
                        this.V[j][i] = 0.0;
                    }
                    ;
                }
                else {
                    for (var k = 0; k < i; k++) {
                        this.d[k] /= scale;
                        h += this.d[k] * this.d[k];
                    }
                    ;
                    var f = this.d[i - 1];
                    var g = Math.sqrt(h);
                    if (f > 0) {
                        g = -g;
                    }
                    this.e[i] = scale * g;
                    h = h - f * g;
                    this.d[i - 1] = f - g;
                    for (var j = 0; j < i; j++) {
                        this.e[j] = 0.0;
                    }
                    ;
                    for (var j = 0; j < i; j++) {
                        f = this.d[j];
                        this.V[j][i] = f;
                        g = this.e[j] + this.V[j][j] * f;
                        for (var k = j + 1; k <= i - 1; k++) {
                            g += this.V[k][j] * this.d[k];
                            this.e[k] += this.V[k][j] * f;
                        }
                        ;
                        this.e[j] = g;
                    }
                    ;
                    f = 0.0;
                    for (var j = 0; j < i; j++) {
                        this.e[j] /= h;
                        f += this.e[j] * this.d[j];
                    }
                    ;
                    var hh = f / (h + h);
                    for (var j = 0; j < i; j++) {
                        this.e[j] -= hh * this.d[j];
                    }
                    ;
                    for (var j = 0; j < i; j++) {
                        f = this.d[j];
                        g = this.e[j];
                        for (var k = j; k <= i - 1; k++) {
                            this.V[k][j] -= (f * this.e[k] + g * this.d[k]);
                        }
                        ;
                        this.d[j] = this.V[i - 1][j];
                        this.V[i][j] = 0.0;
                    }
                    ;
                }
                this.d[i] = h;
            }
            ;
            for (var i = 0; i < this.n - 1; i++) {
                this.V[this.n - 1][i] = this.V[i][i];
                this.V[i][i] = 1.0;
                var h = this.d[i + 1];
                if (h !== 0.0) {
                    for (var k = 0; k <= i; k++) {
                        this.d[k] = this.V[k][i + 1] / h;
                    }
                    ;
                    for (var j = 0; j <= i; j++) {
                        var g = 0.0;
                        for (var k = 0; k <= i; k++) {
                            g += this.V[k][i + 1] * this.V[k][j];
                        }
                        ;
                        for (var k = 0; k <= i; k++) {
                            this.V[k][j] -= g * this.d[k];
                        }
                        ;
                    }
                    ;
                }
                for (var k = 0; k <= i; k++) {
                    this.V[k][i + 1] = 0.0;
                }
                ;
            }
            ;
            for (var j = 0; j < this.n; j++) {
                this.d[j] = this.V[this.n - 1][j];
                this.V[this.n - 1][j] = 0.0;
            }
            ;
            this.V[this.n - 1][this.n - 1] = 1.0;
            this.e[0] = 0.0;
        };
        /*private*/ EigenvalueDecomposition.prototype.tql2 = function () {
            for (var i = 1; i < this.n; i++) {
                this.e[i - 1] = this.e[i];
            }
            ;
            this.e[this.n - 1] = 0.0;
            var f = 0.0;
            var tst1 = 0.0;
            var eps = Math.pow(2.0, -52.0);
            for (var l = 0; l < this.n; l++) {
                tst1 = Math.max(tst1, Math.abs(this.d[l]) + Math.abs(this.e[l]));
                var m = l;
                while ((m < this.n)) {
                    if (Math.abs(this.e[m]) <= eps * tst1) {
                        break;
                    }
                    m++;
                }
                ;
                if (m > l) {
                    var iter = 0;
                    do {
                        iter = iter + 1;
                        var g = this.d[l];
                        var p = (this.d[l + 1] - g) / (2.0 * this.e[l]);
                        var r = Jama.util.Maths.hypot(p, 1.0);
                        if (p < 0) {
                            r = -r;
                        }
                        this.d[l] = this.e[l] / (p + r);
                        this.d[l + 1] = this.e[l] * (p + r);
                        var dl1 = this.d[l + 1];
                        var h = g - this.d[l];
                        for (var i = l + 2; i < this.n; i++) {
                            this.d[i] -= h;
                        }
                        ;
                        f = f + h;
                        p = this.d[m];
                        var c = 1.0;
                        var c2 = c;
                        var c3 = c;
                        var el1 = this.e[l + 1];
                        var s = 0.0;
                        var s2 = 0.0;
                        for (var i = m - 1; i >= l; i--) {
                            c3 = c2;
                            c2 = c;
                            s2 = s;
                            g = c * this.e[i];
                            h = c * p;
                            r = Jama.util.Maths.hypot(p, this.e[i]);
                            this.e[i + 1] = s * r;
                            s = this.e[i] / r;
                            c = p / r;
                            p = c * this.d[i] - s * g;
                            this.d[i + 1] = h + s * (c * g + s * this.d[i]);
                            for (var k = 0; k < this.n; k++) {
                                h = this.V[k][i + 1];
                                this.V[k][i + 1] = s * this.V[k][i] + c * h;
                                this.V[k][i] = c * this.V[k][i] - s * h;
                            }
                            ;
                        }
                        ;
                        p = -s * s2 * c3 * el1 * this.e[l] / dl1;
                        this.e[l] = s * p;
                        this.d[l] = c * p;
                    } while ((Math.abs(this.e[l]) > eps * tst1));
                }
                this.d[l] = this.d[l] + f;
                this.e[l] = 0.0;
            }
            ;
            for (var i = 0; i < this.n - 1; i++) {
                var k = i;
                var p = this.d[i];
                for (var j = i + 1; j < this.n; j++) {
                    if (this.d[j] < p) {
                        k = j;
                        p = this.d[j];
                    }
                }
                ;
                if (k !== i) {
                    this.d[k] = this.d[i];
                    this.d[i] = p;
                    for (var j = 0; j < this.n; j++) {
                        p = this.V[j][i];
                        this.V[j][i] = this.V[j][k];
                        this.V[j][k] = p;
                    }
                    ;
                }
            }
            ;
        };
        /*private*/ EigenvalueDecomposition.prototype.orthes = function () {
            var low = 0;
            var high = this.n - 1;
            for (var m = low + 1; m <= high - 1; m++) {
                var scale = 0.0;
                for (var i = m; i <= high; i++) {
                    scale = scale + Math.abs(this.H[i][m - 1]);
                }
                ;
                if (scale !== 0.0) {
                    var h = 0.0;
                    for (var i = high; i >= m; i--) {
                        this.ort[i] = this.H[i][m - 1] / scale;
                        h += this.ort[i] * this.ort[i];
                    }
                    ;
                    var g = Math.sqrt(h);
                    if (this.ort[m] > 0) {
                        g = -g;
                    }
                    h = h - this.ort[m] * g;
                    this.ort[m] = this.ort[m] - g;
                    for (var j = m; j < this.n; j++) {
                        var f = 0.0;
                        for (var i = high; i >= m; i--) {
                            f += this.ort[i] * this.H[i][j];
                        }
                        ;
                        f = f / h;
                        for (var i = m; i <= high; i++) {
                            this.H[i][j] -= f * this.ort[i];
                        }
                        ;
                    }
                    ;
                    for (var i = 0; i <= high; i++) {
                        var f = 0.0;
                        for (var j = high; j >= m; j--) {
                            f += this.ort[j] * this.H[i][j];
                        }
                        ;
                        f = f / h;
                        for (var j = m; j <= high; j++) {
                            this.H[i][j] -= f * this.ort[j];
                        }
                        ;
                    }
                    ;
                    this.ort[m] = scale * this.ort[m];
                    this.H[m][m - 1] = scale * g;
                }
            }
            ;
            for (var i = 0; i < this.n; i++) {
                for (var j = 0; j < this.n; j++) {
                    this.V[i][j] = (i === j ? 1.0 : 0.0);
                }
                ;
            }
            ;
            for (var m = high - 1; m >= low + 1; m--) {
                if (this.H[m][m - 1] !== 0.0) {
                    for (var i = m + 1; i <= high; i++) {
                        this.ort[i] = this.H[i][m - 1];
                    }
                    ;
                    for (var j = m; j <= high; j++) {
                        var g = 0.0;
                        for (var i = m; i <= high; i++) {
                            g += this.ort[i] * this.V[i][j];
                        }
                        ;
                        g = (g / this.ort[m]) / this.H[m][m - 1];
                        for (var i = m; i <= high; i++) {
                            this.V[i][j] += g * this.ort[i];
                        }
                        ;
                    }
                    ;
                }
            }
            ;
        };
        /*private*/ EigenvalueDecomposition.prototype.cdiv = function (xr, xi, yr, yi) {
            var r;
            var d;
            if (Math.abs(yr) > Math.abs(yi)) {
                r = yi / yr;
                d = yr + r * yi;
                this.cdivr = (xr + r * xi) / d;
                this.cdivi = (xi - r * xr) / d;
            }
            else {
                r = yr / yi;
                d = yi + r * yr;
                this.cdivr = (r * xr + xi) / d;
                this.cdivi = (r * xi - xr) / d;
            }
        };
        /*private*/ EigenvalueDecomposition.prototype.hqr2 = function () {
            var nn = this.n;
            var n = nn - 1;
            var low = 0;
            var high = nn - 1;
            var eps = Math.pow(2.0, -52.0);
            var exshift = 0.0;
            var p = 0;
            var q = 0;
            var r = 0;
            var s = 0;
            var z = 0;
            var t;
            var w;
            var x;
            var y;
            var norm = 0.0;
            for (var i = 0; i < nn; i++) {
                if ((function (lhs, rhs) { return lhs || rhs; })(i < low, i > high)) {
                    this.d[i] = this.H[i][i];
                    this.e[i] = 0.0;
                }
                for (var j = Math.max(i - 1, 0); j < nn; j++) {
                    norm = norm + Math.abs(this.H[i][j]);
                }
                ;
            }
            ;
            var iter = 0;
            while ((n >= low)) {
                var l = n;
                while ((l > low)) {
                    s = Math.abs(this.H[l - 1][l - 1]) + Math.abs(this.H[l][l]);
                    if (s === 0.0) {
                        s = norm;
                    }
                    if (Math.abs(this.H[l][l - 1]) < eps * s) {
                        break;
                    }
                    l--;
                }
                ;
                if (l === n) {
                    this.H[n][n] = this.H[n][n] + exshift;
                    this.d[n] = this.H[n][n];
                    this.e[n] = 0.0;
                    n--;
                    iter = 0;
                }
                else if (l === n - 1) {
                    w = this.H[n][n - 1] * this.H[n - 1][n];
                    p = (this.H[n - 1][n - 1] - this.H[n][n]) / 2.0;
                    q = p * p + w;
                    z = Math.sqrt(Math.abs(q));
                    this.H[n][n] = this.H[n][n] + exshift;
                    this.H[n - 1][n - 1] = this.H[n - 1][n - 1] + exshift;
                    x = this.H[n][n];
                    if (q >= 0) {
                        if (p >= 0) {
                            z = p + z;
                        }
                        else {
                            z = p - z;
                        }
                        this.d[n - 1] = x + z;
                        this.d[n] = this.d[n - 1];
                        if (z !== 0.0) {
                            this.d[n] = x - w / z;
                        }
                        this.e[n - 1] = 0.0;
                        this.e[n] = 0.0;
                        x = this.H[n][n - 1];
                        s = Math.abs(x) + Math.abs(z);
                        p = x / s;
                        q = z / s;
                        r = Math.sqrt(p * p + q * q);
                        p = p / r;
                        q = q / r;
                        for (var j = n - 1; j < nn; j++) {
                            z = this.H[n - 1][j];
                            this.H[n - 1][j] = q * z + p * this.H[n][j];
                            this.H[n][j] = q * this.H[n][j] - p * z;
                        }
                        ;
                        for (var i = 0; i <= n; i++) {
                            z = this.H[i][n - 1];
                            this.H[i][n - 1] = q * z + p * this.H[i][n];
                            this.H[i][n] = q * this.H[i][n] - p * z;
                        }
                        ;
                        for (var i = low; i <= high; i++) {
                            z = this.V[i][n - 1];
                            this.V[i][n - 1] = q * z + p * this.V[i][n];
                            this.V[i][n] = q * this.V[i][n] - p * z;
                        }
                        ;
                    }
                    else {
                        this.d[n - 1] = x + p;
                        this.d[n] = x + p;
                        this.e[n - 1] = z;
                        this.e[n] = -z;
                    }
                    n = n - 2;
                    iter = 0;
                }
                else {
                    x = this.H[n][n];
                    y = 0.0;
                    w = 0.0;
                    if (l < n) {
                        y = this.H[n - 1][n - 1];
                        w = this.H[n][n - 1] * this.H[n - 1][n];
                    }
                    if (iter === 10) {
                        exshift += x;
                        for (var i = low; i <= n; i++) {
                            this.H[i][i] -= x;
                        }
                        ;
                        s = Math.abs(this.H[n][n - 1]) + Math.abs(this.H[n - 1][n - 2]);
                        x = y = 0.75 * s;
                        w = -0.4375 * s * s;
                    }
                    if (iter === 30) {
                        s = (y - x) / 2.0;
                        s = s * s + w;
                        if (s > 0) {
                            s = Math.sqrt(s);
                            if (y < x) {
                                s = -s;
                            }
                            s = x - w / ((y - x) / 2.0 + s);
                            for (var i = low; i <= n; i++) {
                                this.H[i][i] -= s;
                            }
                            ;
                            exshift += s;
                            x = y = w = 0.964;
                        }
                    }
                    iter = iter + 1;
                    var m = n - 2;
                    while ((m >= l)) {
                        z = this.H[m][m];
                        r = x - z;
                        s = y - z;
                        p = (r * s - w) / this.H[m + 1][m] + this.H[m][m + 1];
                        q = this.H[m + 1][m + 1] - z - r - s;
                        r = this.H[m + 2][m + 1];
                        s = Math.abs(p) + Math.abs(q) + Math.abs(r);
                        p = p / s;
                        q = q / s;
                        r = r / s;
                        if (m === l) {
                            break;
                        }
                        if (Math.abs(this.H[m][m - 1]) * (Math.abs(q) + Math.abs(r)) < eps * (Math.abs(p) * (Math.abs(this.H[m - 1][m - 1]) + Math.abs(z) + Math.abs(this.H[m + 1][m + 1])))) {
                            break;
                        }
                        m--;
                    }
                    ;
                    for (var i = m + 2; i <= n; i++) {
                        this.H[i][i - 2] = 0.0;
                        if (i > m + 2) {
                            this.H[i][i - 3] = 0.0;
                        }
                    }
                    ;
                    for (var k = m; k <= n - 1; k++) {
                        var notlast = (k !== n - 1);
                        if (k !== m) {
                            p = this.H[k][k - 1];
                            q = this.H[k + 1][k - 1];
                            r = (notlast ? this.H[k + 2][k - 1] : 0.0);
                            x = Math.abs(p) + Math.abs(q) + Math.abs(r);
                            if (x === 0.0) {
                                continue;
                            }
                            p = p / x;
                            q = q / x;
                            r = r / x;
                        }
                        s = Math.sqrt(p * p + q * q + r * r);
                        if (p < 0) {
                            s = -s;
                        }
                        if (s !== 0) {
                            if (k !== m) {
                                this.H[k][k - 1] = -s * x;
                            }
                            else if (l !== m) {
                                this.H[k][k - 1] = -this.H[k][k - 1];
                            }
                            p = p + s;
                            x = p / s;
                            y = q / s;
                            z = r / s;
                            q = q / p;
                            r = r / p;
                            for (var j = k; j < nn; j++) {
                                p = this.H[k][j] + q * this.H[k + 1][j];
                                if (notlast) {
                                    p = p + r * this.H[k + 2][j];
                                    this.H[k + 2][j] = this.H[k + 2][j] - p * z;
                                }
                                this.H[k][j] = this.H[k][j] - p * x;
                                this.H[k + 1][j] = this.H[k + 1][j] - p * y;
                            }
                            ;
                            for (var i = 0; i <= Math.min(n, k + 3); i++) {
                                p = x * this.H[i][k] + y * this.H[i][k + 1];
                                if (notlast) {
                                    p = p + z * this.H[i][k + 2];
                                    this.H[i][k + 2] = this.H[i][k + 2] - p * r;
                                }
                                this.H[i][k] = this.H[i][k] - p;
                                this.H[i][k + 1] = this.H[i][k + 1] - p * q;
                            }
                            ;
                            for (var i = low; i <= high; i++) {
                                p = x * this.V[i][k] + y * this.V[i][k + 1];
                                if (notlast) {
                                    p = p + z * this.V[i][k + 2];
                                    this.V[i][k + 2] = this.V[i][k + 2] - p * r;
                                }
                                this.V[i][k] = this.V[i][k] - p;
                                this.V[i][k + 1] = this.V[i][k + 1] - p * q;
                            }
                            ;
                        }
                    }
                    ;
                }
            }
            ;
            if (norm === 0.0) {
                return;
            }
            for (n = nn - 1; n >= 0; n--) {
                p = this.d[n];
                q = this.e[n];
                if (q === 0) {
                    var l = n;
                    this.H[n][n] = 1.0;
                    for (var i = n - 1; i >= 0; i--) {
                        w = this.H[i][i] - p;
                        r = 0.0;
                        for (var j = l; j <= n; j++) {
                            r = r + this.H[i][j] * this.H[j][n];
                        }
                        ;
                        if (this.e[i] < 0.0) {
                            z = w;
                            s = r;
                        }
                        else {
                            l = i;
                            if (this.e[i] === 0.0) {
                                if (w !== 0.0) {
                                    this.H[i][n] = -r / w;
                                }
                                else {
                                    this.H[i][n] = -r / (eps * norm);
                                }
                            }
                            else {
                                x = this.H[i][i + 1];
                                y = this.H[i + 1][i];
                                q = (this.d[i] - p) * (this.d[i] - p) + this.e[i] * this.e[i];
                                t = (x * s - z * r) / q;
                                this.H[i][n] = t;
                                if (Math.abs(x) > Math.abs(z)) {
                                    this.H[i + 1][n] = (-r - w * t) / x;
                                }
                                else {
                                    this.H[i + 1][n] = (-s - y * t) / z;
                                }
                            }
                            t = Math.abs(this.H[i][n]);
                            if ((eps * t) * t > 1) {
                                for (var j = i; j <= n; j++) {
                                    this.H[j][n] = this.H[j][n] / t;
                                }
                                ;
                            }
                        }
                    }
                    ;
                }
                else if (q < 0) {
                    var l = n - 1;
                    if (Math.abs(this.H[n][n - 1]) > Math.abs(this.H[n - 1][n])) {
                        this.H[n - 1][n - 1] = q / this.H[n][n - 1];
                        this.H[n - 1][n] = -(this.H[n][n] - p) / this.H[n][n - 1];
                    }
                    else {
                        this.cdiv(0.0, -this.H[n - 1][n], this.H[n - 1][n - 1] - p, q);
                        this.H[n - 1][n - 1] = this.cdivr;
                        this.H[n - 1][n] = this.cdivi;
                    }
                    this.H[n][n - 1] = 0.0;
                    this.H[n][n] = 1.0;
                    for (var i = n - 2; i >= 0; i--) {
                        var ra = void 0;
                        var sa = void 0;
                        var vr = void 0;
                        var vi = void 0;
                        ra = 0.0;
                        sa = 0.0;
                        for (var j = l; j <= n; j++) {
                            ra = ra + this.H[i][j] * this.H[j][n - 1];
                            sa = sa + this.H[i][j] * this.H[j][n];
                        }
                        ;
                        w = this.H[i][i] - p;
                        if (this.e[i] < 0.0) {
                            z = w;
                            r = ra;
                            s = sa;
                        }
                        else {
                            l = i;
                            if (this.e[i] === 0) {
                                this.cdiv(-ra, -sa, w, q);
                                this.H[i][n - 1] = this.cdivr;
                                this.H[i][n] = this.cdivi;
                            }
                            else {
                                x = this.H[i][i + 1];
                                y = this.H[i + 1][i];
                                vr = (this.d[i] - p) * (this.d[i] - p) + this.e[i] * this.e[i] - q * q;
                                vi = (this.d[i] - p) * 2.0 * q;
                                if ((function (lhs, rhs) { return lhs && rhs; })(vr === 0.0, vi === 0.0)) {
                                    vr = eps * norm * (Math.abs(w) + Math.abs(q) + Math.abs(x) + Math.abs(y) + Math.abs(z));
                                }
                                this.cdiv(x * r - z * ra + q * sa, x * s - z * sa - q * ra, vr, vi);
                                this.H[i][n - 1] = this.cdivr;
                                this.H[i][n] = this.cdivi;
                                if (Math.abs(x) > (Math.abs(z) + Math.abs(q))) {
                                    this.H[i + 1][n - 1] = (-ra - w * this.H[i][n - 1] + q * this.H[i][n]) / x;
                                    this.H[i + 1][n] = (-sa - w * this.H[i][n] - q * this.H[i][n - 1]) / x;
                                }
                                else {
                                    this.cdiv(-r - y * this.H[i][n - 1], -s - y * this.H[i][n], z, q);
                                    this.H[i + 1][n - 1] = this.cdivr;
                                    this.H[i + 1][n] = this.cdivi;
                                }
                            }
                            t = Math.max(Math.abs(this.H[i][n - 1]), Math.abs(this.H[i][n]));
                            if ((eps * t) * t > 1) {
                                for (var j = i; j <= n; j++) {
                                    this.H[j][n - 1] = this.H[j][n - 1] / t;
                                    this.H[j][n] = this.H[j][n] / t;
                                }
                                ;
                            }
                        }
                    }
                    ;
                }
            }
            ;
            for (var i = 0; i < nn; i++) {
                if ((function (lhs, rhs) { return lhs || rhs; })(i < low, i > high)) {
                    for (var j = i; j < nn; j++) {
                        this.V[i][j] = this.H[i][j];
                    }
                    ;
                }
            }
            ;
            for (var j = nn - 1; j >= low; j--) {
                for (var i = low; i <= high; i++) {
                    z = 0.0;
                    for (var k = low; k <= Math.min(j, high); k++) {
                        z = z + this.V[i][k] * this.H[k][j];
                    }
                    ;
                    this.V[i][j] = z;
                }
                ;
            }
            ;
        };
        /**
         * Return the eigenvector matrix
         * @return     {Jama.Matrix} V
         */
        EigenvalueDecomposition.prototype.getV = function () {
            return new Jama.Matrix(this.V, this.n, this.n);
        };
        /**
         * Return the real parts of the eigenvalues
         * @return     {Array} real(diag(D))
         */
        EigenvalueDecomposition.prototype.getRealEigenvalues = function () {
            return this.d;
        };
        /**
         * Return the imaginary parts of the eigenvalues
         * @return     {Array} imag(diag(D))
         */
        EigenvalueDecomposition.prototype.getImagEigenvalues = function () {
            return this.e;
        };
        /**
         * Return the block diagonal eigenvalue matrix
         * @return     {Jama.Matrix} D
         */
        EigenvalueDecomposition.prototype.getD = function () {
            var X = new Jama.Matrix(this.n, this.n);
            var D = X.getArray();
            for (var i = 0; i < this.n; i++) {
                for (var j = 0; j < this.n; j++) {
                    D[i][j] = 0.0;
                }
                ;
                D[i][i] = this.d[i];
                if (this.e[i] > 0) {
                    D[i][i + 1] = this.e[i];
                }
                else if (this.e[i] < 0) {
                    D[i][i - 1] = this.e[i];
                }
            }
            ;
            return X;
        };
        return EigenvalueDecomposition;
    }());
    EigenvalueDecomposition.serialVersionUID = 1;
    Jama.EigenvalueDecomposition = EigenvalueDecomposition;
    EigenvalueDecomposition["__class"] = "Jama.EigenvalueDecomposition";
    EigenvalueDecomposition["__interfaces"] = ["java.io.Serializable"];
})(Jama || (Jama = {}));
(function (Jama) {
    /**
     * Construct an m-by-n constant matrix.
     * @param {number} m    Number of rows.
     * @param {number} n    Number of colums.
     * @param {number} s    Fill the matrix with this scalar value.
     * @class
     * @author The MathWorks, Inc. and the National Institute of Standards and Technology.
     */
    var Matrix = (function () {
        function Matrix(A, m, n) {
            var _this = this;
            if (((A != null && A instanceof Array && (A.length == 0 || A[0] == null || A[0] instanceof Array)) || A === null) && ((typeof m === 'number') || m === null) && ((typeof n === 'number') || n === null)) {
                var __args = Array.prototype.slice.call(arguments);
                this.A = null;
                this.m = 0;
                this.n = 0;
                this.A = null;
                this.m = 0;
                this.n = 0;
                (function () {
                    _this.A = A;
                    _this.m = m;
                    _this.n = n;
                })();
            }
            else if (((typeof A === 'number') || A === null) && ((typeof m === 'number') || m === null) && ((typeof n === 'number') || n === null)) {
                var __args = Array.prototype.slice.call(arguments);
                var m_1 = __args[0];
                var n_1 = __args[1];
                var s_1 = __args[2];
                this.A = null;
                this.m = 0;
                this.n = 0;
                this.A = null;
                this.m = 0;
                this.n = 0;
                (function () {
                    _this.m = m_1;
                    _this.n = n_1;
                    _this.A = (function (dims) { var allocate = function (dims) { if (dims.length == 0) {
                        return 0;
                    }
                    else {
                        var array = [];
                        for (var i = 0; i < dims[0]; i++) {
                            array.push(allocate(dims.slice(1)));
                        }
                        return array;
                    } }; return allocate(dims); })([m_1, n_1]);
                    for (var i = 0; i < m_1; i++) {
                        for (var j = 0; j < n_1; j++) {
                            _this.A[i][j] = s_1;
                        }
                        ;
                    }
                    ;
                })();
            }
            else if (((A != null && A instanceof Array && (A.length == 0 || A[0] == null || (typeof A[0] === 'number'))) || A === null) && ((typeof m === 'number') || m === null) && n === undefined) {
                var __args = Array.prototype.slice.call(arguments);
                var vals_1 = __args[0];
                this.A = null;
                this.m = 0;
                this.n = 0;
                this.A = null;
                this.m = 0;
                this.n = 0;
                (function () {
                    _this.m = m;
                    _this.n = (m !== 0 ? (vals_1.length / m | 0) : 0);
                    if (m * _this.n !== vals_1.length) {
                        throw Object.defineProperty(new Error("Array length must be a multiple of m."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.IllegalArgumentException', 'java.lang.Exception'] });
                    }
                    _this.A = (function (dims) { var allocate = function (dims) { if (dims.length == 0) {
                        return 0;
                    }
                    else {
                        var array = [];
                        for (var i = 0; i < dims[0]; i++) {
                            array.push(allocate(dims.slice(1)));
                        }
                        return array;
                    } }; return allocate(dims); })([m, _this.n]);
                    for (var i = 0; i < m; i++) {
                        for (var j = 0; j < _this.n; j++) {
                            _this.A[i][j] = vals_1[i + j * m];
                        }
                        ;
                    }
                    ;
                })();
            }
            else if (((typeof A === 'number') || A === null) && ((typeof m === 'number') || m === null) && n === undefined) {
                var __args = Array.prototype.slice.call(arguments);
                var m_2 = __args[0];
                var n_2 = __args[1];
                this.A = null;
                this.m = 0;
                this.n = 0;
                this.A = null;
                this.m = 0;
                this.n = 0;
                (function () {
                    _this.m = m_2;
                    _this.n = n_2;
                    _this.A = (function (dims) { var allocate = function (dims) { if (dims.length == 0) {
                        return 0;
                    }
                    else {
                        var array = [];
                        for (var i = 0; i < dims[0]; i++) {
                            array.push(allocate(dims.slice(1)));
                        }
                        return array;
                    } }; return allocate(dims); })([m_2, n_2]);
                })();
            }
            else if (((A != null && A instanceof Array && (A.length == 0 || A[0] == null || A[0] instanceof Array)) || A === null) && m === undefined && n === undefined) {
                var __args = Array.prototype.slice.call(arguments);
                this.A = null;
                this.m = 0;
                this.n = 0;
                this.A = null;
                this.m = 0;
                this.n = 0;
                (function () {
                    _this.m = A.length;
                    _this.n = A[0].length;
                    for (var i = 0; i < _this.m; i++) {
                        if (A[i].length !== _this.n) {
                            throw Object.defineProperty(new Error("All rows must have the same length."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.IllegalArgumentException', 'java.lang.Exception'] });
                        }
                    }
                    ;
                    _this.A = A;
                })();
            }
            else
                throw new Error('invalid overload');
        }
        /**
         * Construct a matrix from a copy of a 2-D array.
         * @param {Array} A    Two-dimensional array of doubles.
         * @exception  IllegalArgumentException All rows must have the same length
         * @return {Jama.Matrix}
         */
        Matrix.constructWithCopy = function (A) {
            var m = A.length;
            var n = A[0].length;
            var X = new Matrix(m, n);
            var C = X.getArray();
            for (var i = 0; i < m; i++) {
                if (A[i].length !== n) {
                    throw Object.defineProperty(new Error("All rows must have the same length."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.IllegalArgumentException', 'java.lang.Exception'] });
                }
                for (var j = 0; j < n; j++) {
                    C[i][j] = A[i][j];
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Make a deep copy of a matrix
         * @return {Jama.Matrix}
         */
        Matrix.prototype.copy = function () {
            var X = new Matrix(this.m, this.n);
            var C = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    C[i][j] = this.A[i][j];
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Clone the Matrix object.
         * @return {*}
         */
        Matrix.prototype.clone = function () {
            return this.copy();
        };
        /**
         * Access the internal two-dimensional array.
         * @return     {Array} Pointer to the two-dimensional array of matrix elements.
         */
        Matrix.prototype.getArray = function () {
            return this.A;
        };
        /**
         * Copy the internal two-dimensional array.
         * @return     {Array} Two-dimensional array copy of matrix elements.
         */
        Matrix.prototype.getArrayCopy = function () {
            var C = (function (dims) { var allocate = function (dims) { if (dims.length == 0) {
                return 0;
            }
            else {
                var array = [];
                for (var i = 0; i < dims[0]; i++) {
                    array.push(allocate(dims.slice(1)));
                }
                return array;
            } }; return allocate(dims); })([this.m, this.n]);
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    C[i][j] = this.A[i][j];
                }
                ;
            }
            ;
            return C;
        };
        /**
         * Make a one-dimensional column packed copy of the internal array.
         * @return     {Array} Matrix elements packed in a one-dimensional array by columns.
         */
        Matrix.prototype.getColumnPackedCopy = function () {
            var vals = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.m * this.n);
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    vals[i + j * this.m] = this.A[i][j];
                }
                ;
            }
            ;
            return vals;
        };
        /**
         * Make a one-dimensional row packed copy of the internal array.
         * @return     {Array} Matrix elements packed in a one-dimensional array by rows.
         */
        Matrix.prototype.getRowPackedCopy = function () {
            var vals = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.m * this.n);
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    vals[i * this.n + j] = this.A[i][j];
                }
                ;
            }
            ;
            return vals;
        };
        /**
         * Get row dimension.
         * @return     {number} m, the number of rows.
         */
        Matrix.prototype.getRowDimension = function () {
            return this.m;
        };
        /**
         * Get column dimension.
         * @return     {number} n, the number of columns.
         */
        Matrix.prototype.getColumnDimension = function () {
            return this.n;
        };
        /**
         * Get a single element.
         * @param {number} i    Row index.
         * @param {number} j    Column index.
         * @return     {number} A(i,j)
         * @exception  ArrayIndexOutOfBoundsException
         */
        Matrix.prototype.get = function (i, j) {
            return this.A[i][j];
        };
        Matrix.prototype.getMatrix$int$int$int$int = function (i0, i1, j0, j1) {
            var X = new Matrix(i1 - i0 + 1, j1 - j0 + 1);
            var B = X.getArray();
            try {
                for (var i = i0; i <= i1; i++) {
                    for (var j = j0; j <= j1; j++) {
                        B[i - i0][j - j0] = this.A[i][j];
                    }
                    ;
                }
                ;
            }
            catch (e) {
                throw Object.defineProperty(new Error("Submatrix indices"), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.IndexOutOfBoundsException', 'java.lang.Object', 'java.lang.ArrayIndexOutOfBoundsException', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            ;
            return X;
        };
        /**
         * Get a submatrix.
         * @param {number} i0   Initial row index
         * @param {number} i1   Final row index
         * @param {number} j0   Initial column index
         * @param {number} j1   Final column index
         * @return     {Jama.Matrix} A(i0:i1,j0:j1)
         * @exception  ArrayIndexOutOfBoundsException Submatrix indices
         */
        Matrix.prototype.getMatrix = function (i0, i1, j0, j1) {
            if (((typeof i0 === 'number') || i0 === null) && ((typeof i1 === 'number') || i1 === null) && ((typeof j0 === 'number') || j0 === null) && ((typeof j1 === 'number') || j1 === null)) {
                return this.getMatrix$int$int$int$int(i0, i1, j0, j1);
            }
            else if (((i0 != null && i0 instanceof Array && (i0.length == 0 || i0[0] == null || (typeof i0[0] === 'number'))) || i0 === null) && ((typeof i1 === 'number') || i1 === null) && ((typeof j0 === 'number') || j0 === null) && j1 === undefined) {
                return this.getMatrix$int_A$int$int(i0, i1, j0);
            }
            else if (((typeof i0 === 'number') || i0 === null) && ((typeof i1 === 'number') || i1 === null) && ((j0 != null && j0 instanceof Array && (j0.length == 0 || j0[0] == null || (typeof j0[0] === 'number'))) || j0 === null) && j1 === undefined) {
                return this.getMatrix$int$int$int_A(i0, i1, j0);
            }
            else if (((i0 != null && i0 instanceof Array && (i0.length == 0 || i0[0] == null || (typeof i0[0] === 'number'))) || i0 === null) && ((i1 != null && i1 instanceof Array && (i1.length == 0 || i1[0] == null || (typeof i1[0] === 'number'))) || i1 === null) && j0 === undefined && j1 === undefined) {
                return this.getMatrix$int_A$int_A(i0, i1);
            }
            else
                throw new Error('invalid overload');
        };
        Matrix.prototype.getMatrix$int_A$int_A = function (r, c) {
            var X = new Matrix(r.length, c.length);
            var B = X.getArray();
            try {
                for (var i = 0; i < r.length; i++) {
                    for (var j = 0; j < c.length; j++) {
                        B[i][j] = this.A[r[i]][c[j]];
                    }
                    ;
                }
                ;
            }
            catch (e) {
                throw Object.defineProperty(new Error("Submatrix indices"), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.IndexOutOfBoundsException', 'java.lang.Object', 'java.lang.ArrayIndexOutOfBoundsException', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            ;
            return X;
        };
        Matrix.prototype.getMatrix$int$int$int_A = function (i0, i1, c) {
            var X = new Matrix(i1 - i0 + 1, c.length);
            var B = X.getArray();
            try {
                for (var i = i0; i <= i1; i++) {
                    for (var j = 0; j < c.length; j++) {
                        B[i - i0][j] = this.A[i][c[j]];
                    }
                    ;
                }
                ;
            }
            catch (e) {
                throw Object.defineProperty(new Error("Submatrix indices"), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.IndexOutOfBoundsException', 'java.lang.Object', 'java.lang.ArrayIndexOutOfBoundsException', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            ;
            return X;
        };
        Matrix.prototype.getMatrix$int_A$int$int = function (r, j0, j1) {
            var X = new Matrix(r.length, j1 - j0 + 1);
            var B = X.getArray();
            try {
                for (var i = 0; i < r.length; i++) {
                    for (var j = j0; j <= j1; j++) {
                        B[i][j - j0] = this.A[r[i]][j];
                    }
                    ;
                }
                ;
            }
            catch (e) {
                throw Object.defineProperty(new Error("Submatrix indices"), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.IndexOutOfBoundsException', 'java.lang.Object', 'java.lang.ArrayIndexOutOfBoundsException', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            ;
            return X;
        };
        /**
         * Set a single element.
         * @param {number} i    Row index.
         * @param {number} j    Column index.
         * @param {number} s    A(i,j).
         * @exception  ArrayIndexOutOfBoundsException
         */
        Matrix.prototype.set = function (i, j, s) {
            this.A[i][j] = s;
        };
        Matrix.prototype.setMatrix$int$int$int$int$Jama_Matrix = function (i0, i1, j0, j1, X) {
            try {
                for (var i = i0; i <= i1; i++) {
                    for (var j = j0; j <= j1; j++) {
                        this.A[i][j] = X.get(i - i0, j - j0);
                    }
                    ;
                }
                ;
            }
            catch (e) {
                throw Object.defineProperty(new Error("Submatrix indices"), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.IndexOutOfBoundsException', 'java.lang.Object', 'java.lang.ArrayIndexOutOfBoundsException', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            ;
        };
        /**
         * Set a submatrix.
         * @param {number} i0   Initial row index
         * @param {number} i1   Final row index
         * @param {number} j0   Initial column index
         * @param {number} j1   Final column index
         * @param {Jama.Matrix} X    A(i0:i1,j0:j1)
         * @exception  ArrayIndexOutOfBoundsException Submatrix indices
         */
        Matrix.prototype.setMatrix = function (i0, i1, j0, j1, X) {
            if (((typeof i0 === 'number') || i0 === null) && ((typeof i1 === 'number') || i1 === null) && ((typeof j0 === 'number') || j0 === null) && ((typeof j1 === 'number') || j1 === null) && ((X != null && X instanceof Jama.Matrix) || X === null)) {
                return this.setMatrix$int$int$int$int$Jama_Matrix(i0, i1, j0, j1, X);
            }
            else if (((i0 != null && i0 instanceof Array && (i0.length == 0 || i0[0] == null || (typeof i0[0] === 'number'))) || i0 === null) && ((typeof i1 === 'number') || i1 === null) && ((typeof j0 === 'number') || j0 === null) && ((j1 != null && j1 instanceof Jama.Matrix) || j1 === null) && X === undefined) {
                return this.setMatrix$int_A$int$int$Jama_Matrix(i0, i1, j0, j1);
            }
            else if (((typeof i0 === 'number') || i0 === null) && ((typeof i1 === 'number') || i1 === null) && ((j0 != null && j0 instanceof Array && (j0.length == 0 || j0[0] == null || (typeof j0[0] === 'number'))) || j0 === null) && ((j1 != null && j1 instanceof Jama.Matrix) || j1 === null) && X === undefined) {
                return this.setMatrix$int$int$int_A$Jama_Matrix(i0, i1, j0, j1);
            }
            else if (((i0 != null && i0 instanceof Array && (i0.length == 0 || i0[0] == null || (typeof i0[0] === 'number'))) || i0 === null) && ((i1 != null && i1 instanceof Array && (i1.length == 0 || i1[0] == null || (typeof i1[0] === 'number'))) || i1 === null) && ((j0 != null && j0 instanceof Jama.Matrix) || j0 === null) && j1 === undefined && X === undefined) {
                return this.setMatrix$int_A$int_A$Jama_Matrix(i0, i1, j0);
            }
            else
                throw new Error('invalid overload');
        };
        Matrix.prototype.setMatrix$int_A$int_A$Jama_Matrix = function (r, c, X) {
            try {
                for (var i = 0; i < r.length; i++) {
                    for (var j = 0; j < c.length; j++) {
                        this.A[r[i]][c[j]] = X.get(i, j);
                    }
                    ;
                }
                ;
            }
            catch (e) {
                throw Object.defineProperty(new Error("Submatrix indices"), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.IndexOutOfBoundsException', 'java.lang.Object', 'java.lang.ArrayIndexOutOfBoundsException', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            ;
        };
        Matrix.prototype.setMatrix$int_A$int$int$Jama_Matrix = function (r, j0, j1, X) {
            try {
                for (var i = 0; i < r.length; i++) {
                    for (var j = j0; j <= j1; j++) {
                        this.A[r[i]][j] = X.get(i, j - j0);
                    }
                    ;
                }
                ;
            }
            catch (e) {
                throw Object.defineProperty(new Error("Submatrix indices"), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.IndexOutOfBoundsException', 'java.lang.Object', 'java.lang.ArrayIndexOutOfBoundsException', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            ;
        };
        Matrix.prototype.setMatrix$int$int$int_A$Jama_Matrix = function (i0, i1, c, X) {
            try {
                for (var i = i0; i <= i1; i++) {
                    for (var j = 0; j < c.length; j++) {
                        this.A[i][c[j]] = X.get(i - i0, j);
                    }
                    ;
                }
                ;
            }
            catch (e) {
                throw Object.defineProperty(new Error("Submatrix indices"), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.IndexOutOfBoundsException', 'java.lang.Object', 'java.lang.ArrayIndexOutOfBoundsException', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            ;
        };
        /**
         * Matrix transpose.
         * @return    {Jama.Matrix} A'
         */
        Matrix.prototype.transpose = function () {
            var X = new Matrix(this.n, this.m);
            var C = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    C[j][i] = this.A[i][j];
                }
                ;
            }
            ;
            return X;
        };
        /**
         * One norm
         * @return    {number} maximum column sum.
         */
        Matrix.prototype.norm1 = function () {
            var f = 0;
            for (var j = 0; j < this.n; j++) {
                var s = 0;
                for (var i = 0; i < this.m; i++) {
                    s += Math.abs(this.A[i][j]);
                }
                ;
                f = Math.max(f, s);
            }
            ;
            return f;
        };
        /**
         * Two norm
         * @return    {number} maximum singular value.
         */
        Matrix.prototype.norm2 = function () {
            return (new Jama.SingularValueDecomposition(this).norm2());
        };
        /**
         * Infinity norm
         * @return    {number} maximum row sum.
         */
        Matrix.prototype.normInf = function () {
            var f = 0;
            for (var i = 0; i < this.m; i++) {
                var s = 0;
                for (var j = 0; j < this.n; j++) {
                    s += Math.abs(this.A[i][j]);
                }
                ;
                f = Math.max(f, s);
            }
            ;
            return f;
        };
        /**
         * Frobenius norm
         * @return    {number} sqrt of sum of squares of all elements.
         */
        Matrix.prototype.normF = function () {
            var f = 0;
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    f = Jama.util.Maths.hypot(f, this.A[i][j]);
                }
                ;
            }
            ;
            return f;
        };
        /**
         * Unary minus
         * @return    {Jama.Matrix} -A
         */
        Matrix.prototype.uminus = function () {
            var X = new Matrix(this.m, this.n);
            var C = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    C[i][j] = -this.A[i][j];
                }
                ;
            }
            ;
            return X;
        };
        /**
         * C = A + B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} A + B
         */
        Matrix.prototype.plus = function (B) {
            this.checkMatrixDimensions(B);
            var X = new Matrix(this.m, this.n);
            var C = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    C[i][j] = this.A[i][j] + B.A[i][j];
                }
                ;
            }
            ;
            return X;
        };
        /**
         * A = A + B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} A + B
         */
        Matrix.prototype.plusEquals = function (B) {
            this.checkMatrixDimensions(B);
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    this.A[i][j] = this.A[i][j] + B.A[i][j];
                }
                ;
            }
            ;
            return this;
        };
        /**
         * C = A - B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} A - B
         */
        Matrix.prototype.minus = function (B) {
            this.checkMatrixDimensions(B);
            var X = new Matrix(this.m, this.n);
            var C = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    C[i][j] = this.A[i][j] - B.A[i][j];
                }
                ;
            }
            ;
            return X;
        };
        /**
         * A = A - B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} A - B
         */
        Matrix.prototype.minusEquals = function (B) {
            this.checkMatrixDimensions(B);
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    this.A[i][j] = this.A[i][j] - B.A[i][j];
                }
                ;
            }
            ;
            return this;
        };
        /**
         * Element-by-element multiplication, C = A.*B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} A.*B
         */
        Matrix.prototype.arrayTimes = function (B) {
            this.checkMatrixDimensions(B);
            var X = new Matrix(this.m, this.n);
            var C = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    C[i][j] = this.A[i][j] * B.A[i][j];
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Element-by-element multiplication in place, A = A.*B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} A.*B
         */
        Matrix.prototype.arrayTimesEquals = function (B) {
            this.checkMatrixDimensions(B);
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    this.A[i][j] = this.A[i][j] * B.A[i][j];
                }
                ;
            }
            ;
            return this;
        };
        /**
         * Element-by-element right division, C = A./B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} A./B
         */
        Matrix.prototype.arrayRightDivide = function (B) {
            this.checkMatrixDimensions(B);
            var X = new Matrix(this.m, this.n);
            var C = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    C[i][j] = this.A[i][j] / B.A[i][j];
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Element-by-element right division in place, A = A./B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} A./B
         */
        Matrix.prototype.arrayRightDivideEquals = function (B) {
            this.checkMatrixDimensions(B);
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    this.A[i][j] = this.A[i][j] / B.A[i][j];
                }
                ;
            }
            ;
            return this;
        };
        /**
         * Element-by-element left division, C = A.\B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} A.\B
         */
        Matrix.prototype.arrayLeftDivide = function (B) {
            this.checkMatrixDimensions(B);
            var X = new Matrix(this.m, this.n);
            var C = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    C[i][j] = B.A[i][j] / this.A[i][j];
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Element-by-element left division in place, A = A.\B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} A.\B
         */
        Matrix.prototype.arrayLeftDivideEquals = function (B) {
            this.checkMatrixDimensions(B);
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    this.A[i][j] = B.A[i][j] / this.A[i][j];
                }
                ;
            }
            ;
            return this;
        };
        Matrix.prototype.times$double = function (s) {
            var X = new Matrix(this.m, this.n);
            var C = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    C[i][j] = s * this.A[i][j];
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Multiply a matrix by a scalar in place, A = s*A
         * @param {number} s    scalar
         * @return     {Jama.Matrix} replace A by s*A
         */
        Matrix.prototype.timesEquals = function (s) {
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    this.A[i][j] = s * this.A[i][j];
                }
                ;
            }
            ;
            return this;
        };
        Matrix.prototype.times$Jama_Matrix = function (B) {
            if (B.m !== this.n) {
                throw Object.defineProperty(new Error("Matrix inner dimensions must agree."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.IllegalArgumentException', 'java.lang.Exception'] });
            }
            var X = new Matrix(this.m, B.n);
            var C = X.getArray();
            var Bcolj = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.n);
            for (var j = 0; j < B.n; j++) {
                for (var k = 0; k < this.n; k++) {
                    Bcolj[k] = B.A[k][j];
                }
                ;
                for (var i = 0; i < this.m; i++) {
                    var Arowi = this.A[i];
                    var s = 0;
                    for (var k = 0; k < this.n; k++) {
                        s += Arowi[k] * Bcolj[k];
                    }
                    ;
                    C[i][j] = s;
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Linear algebraic matrix multiplication, A * B
         * @param {Jama.Matrix} B    another matrix
         * @return     {Jama.Matrix} Matrix product, A * B
         * @exception  IllegalArgumentException Matrix inner dimensions must agree.
         */
        Matrix.prototype.times = function (B) {
            if (((B != null && B instanceof Jama.Matrix) || B === null)) {
                return this.times$Jama_Matrix(B);
            }
            else if (((typeof B === 'number') || B === null)) {
                return this.times$double(B);
            }
            else
                throw new Error('invalid overload');
        };
        /**
         * LU Decomposition
         * @return     {Jama.LUDecomposition} LUDecomposition
         * @see LUDecomposition
         */
        Matrix.prototype.lu = function () {
            return new Jama.LUDecomposition(this);
        };
        /**
         * QR Decomposition
         * @return     {Jama.QRDecomposition} QRDecomposition
         * @see QRDecomposition
         */
        Matrix.prototype.qr = function () {
            return new Jama.QRDecomposition(this);
        };
        /**
         * Cholesky Decomposition
         * @return     {Jama.CholeskyDecomposition} CholeskyDecomposition
         * @see CholeskyDecomposition
         */
        Matrix.prototype.chol = function () {
            return new Jama.CholeskyDecomposition(this);
        };
        /**
         * Singular Value Decomposition
         * @return     {Jama.SingularValueDecomposition} SingularValueDecomposition
         * @see SingularValueDecomposition
         */
        Matrix.prototype.svd = function () {
            return new Jama.SingularValueDecomposition(this);
        };
        /**
         * Eigenvalue Decomposition
         * @return     {Jama.EigenvalueDecomposition} EigenvalueDecomposition
         * @see EigenvalueDecomposition
         */
        Matrix.prototype.eig = function () {
            return new Jama.EigenvalueDecomposition(this);
        };
        /**
         * Solve A*X = B
         * @param {Jama.Matrix} B    right hand side
         * @return     {Jama.Matrix} solution if A is square, least squares solution otherwise
         */
        Matrix.prototype.solve = function (B) {
            return (this.m === this.n ? (new Jama.LUDecomposition(this)).solve(B) : (new Jama.QRDecomposition(this)).solve(B));
        };
        /**
         * Solve X*A = B, which is also A'*X' = B'
         * @param {Jama.Matrix} B    right hand side
         * @return     {Jama.Matrix} solution if A is square, least squares solution otherwise.
         */
        Matrix.prototype.solveTranspose = function (B) {
            return this.transpose().solve(B.transpose());
        };
        /**
         * Matrix inverse or pseudoinverse
         * @return     {Jama.Matrix} inverse(A) if A is square, pseudoinverse otherwise.
         */
        Matrix.prototype.inverse = function () {
            return this.solve(Matrix.identity(this.m, this.m));
        };
        /**
         * Matrix determinant
         * @return     {number} determinant
         */
        Matrix.prototype.det = function () {
            return new Jama.LUDecomposition(this).det();
        };
        /**
         * Matrix rank
         * @return     {number} effective numerical rank, obtained from SVD.
         */
        Matrix.prototype.rank = function () {
            return new Jama.SingularValueDecomposition(this).rank();
        };
        /**
         * Matrix condition (2 norm)
         * @return     {number} ratio of largest to smallest singular value.
         */
        Matrix.prototype.cond = function () {
            return new Jama.SingularValueDecomposition(this).cond();
        };
        /**
         * Matrix trace.
         * @return     {number} sum of the diagonal elements.
         */
        Matrix.prototype.trace = function () {
            var t = 0;
            for (var i = 0; i < Math.min(this.m, this.n); i++) {
                t += this.A[i][i];
            }
            ;
            return t;
        };
        /**
         * Generate matrix with random elements
         * @param {number} m    Number of rows.
         * @param {number} n    Number of colums.
         * @return     {Jama.Matrix} An m-by-n matrix with uniformly distributed random elements.
         */
        Matrix.random = function (m, n) {
            var A = new Matrix(m, n);
            var X = A.getArray();
            for (var i = 0; i < m; i++) {
                for (var j = 0; j < n; j++) {
                    X[i][j] = Math.random();
                }
                ;
            }
            ;
            return A;
        };
        /**
         * Generate identity matrix
         * @param {number} m    Number of rows.
         * @param {number} n    Number of colums.
         * @return     {Jama.Matrix} An m-by-n matrix with ones on the diagonal and zeros elsewhere.
         */
        Matrix.identity = function (m, n) {
            var A = new Matrix(m, n);
            var X = A.getArray();
            for (var i = 0; i < m; i++) {
                for (var j = 0; j < n; j++) {
                    X[i][j] = (i === j ? 1.0 : 0.0);
                }
                ;
            }
            ;
            return A;
        };
        /**
         * Check if size(A) == size(B)
         * @param {Jama.Matrix} B
         * @private
         */
        /*private*/ Matrix.prototype.checkMatrixDimensions = function (B) {
            if (B.m !== this.m || B.n !== this.n) {
                throw Object.defineProperty(new Error("Matrix dimensions must agree."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.IllegalArgumentException', 'java.lang.Exception'] });
            }
        };
        return Matrix;
    }());
    Matrix.serialVersionUID = 1;
    Jama.Matrix = Matrix;
    Matrix["__class"] = "Jama.Matrix";
    Matrix["__interfaces"] = ["java.lang.Cloneable", "java.io.Serializable"];
})(Jama || (Jama = {}));
(function (Jama) {
    /**
     * QR Decomposition, computed by Householder reflections.
     * Structure to access R and the Householder vectors and compute Q.
     * @param {Jama.Matrix} A    Rectangular matrix
     * @class
     */
    var QRDecomposition = (function () {
        function QRDecomposition(A) {
            this.QR = null;
            this.m = 0;
            this.n = 0;
            this.Rdiag = null;
            this.QR = A.getArrayCopy();
            this.m = A.getRowDimension();
            this.n = A.getColumnDimension();
            this.Rdiag = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.n);
            for (var k = 0; k < this.n; k++) {
                var nrm = 0;
                for (var i = k; i < this.m; i++) {
                    nrm = Jama.util.Maths.hypot(nrm, this.QR[i][k]);
                }
                ;
                if (nrm !== 0.0) {
                    if (this.QR[k][k] < 0) {
                        nrm = -nrm;
                    }
                    for (var i = k; i < this.m; i++) {
                        this.QR[i][k] /= nrm;
                    }
                    ;
                    this.QR[k][k] += 1.0;
                    for (var j = k + 1; j < this.n; j++) {
                        var s = 0.0;
                        for (var i = k; i < this.m; i++) {
                            s += this.QR[i][k] * this.QR[i][j];
                        }
                        ;
                        s = -s / this.QR[k][k];
                        for (var i = k; i < this.m; i++) {
                            this.QR[i][j] += s * this.QR[i][k];
                        }
                        ;
                    }
                    ;
                }
                this.Rdiag[k] = -nrm;
            }
            ;
        }
        /**
         * Is the matrix full rank?
         * @return     {boolean} true if R, and hence A, has full rank.
         */
        QRDecomposition.prototype.isFullRank = function () {
            for (var j = 0; j < this.n; j++) {
                if (this.Rdiag[j] === 0)
                    return false;
            }
            ;
            return true;
        };
        /**
         * Return the Householder vectors
         * @return     {Jama.Matrix} Lower trapezoidal matrix whose columns define the reflections
         */
        QRDecomposition.prototype.getH = function () {
            var X = new Jama.Matrix(this.m, this.n);
            var H = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    if (i >= j) {
                        H[i][j] = this.QR[i][j];
                    }
                    else {
                        H[i][j] = 0.0;
                    }
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Return the upper triangular factor
         * @return     {Jama.Matrix} R
         */
        QRDecomposition.prototype.getR = function () {
            var X = new Jama.Matrix(this.n, this.n);
            var R = X.getArray();
            for (var i = 0; i < this.n; i++) {
                for (var j = 0; j < this.n; j++) {
                    if (i < j) {
                        R[i][j] = this.QR[i][j];
                    }
                    else if (i === j) {
                        R[i][j] = this.Rdiag[i];
                    }
                    else {
                        R[i][j] = 0.0;
                    }
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Generate and return the (economy-sized) orthogonal factor
         * @return     {Jama.Matrix} Q
         */
        QRDecomposition.prototype.getQ = function () {
            var X = new Jama.Matrix(this.m, this.n);
            var Q = X.getArray();
            for (var k = this.n - 1; k >= 0; k--) {
                for (var i = 0; i < this.m; i++) {
                    Q[i][k] = 0.0;
                }
                ;
                Q[k][k] = 1.0;
                for (var j = k; j < this.n; j++) {
                    if (this.QR[k][k] !== 0) {
                        var s = 0.0;
                        for (var i = k; i < this.m; i++) {
                            s += this.QR[i][k] * Q[i][j];
                        }
                        ;
                        s = -s / this.QR[k][k];
                        for (var i = k; i < this.m; i++) {
                            Q[i][j] += s * this.QR[i][k];
                        }
                        ;
                    }
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Least squares solution of A*X = B
         * @param {Jama.Matrix} B    A Matrix with as many rows as A and any number of columns.
         * @return     {Jama.Matrix} X that minimizes the two norm of Q*R*X-B.
         * @exception  IllegalArgumentException  Matrix row dimensions must agree.
         * @exception  RuntimeException  Matrix is rank deficient.
         */
        QRDecomposition.prototype.solve = function (B) {
            if (B.getRowDimension() !== this.m) {
                throw Object.defineProperty(new Error("Matrix row dimensions must agree."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.IllegalArgumentException', 'java.lang.Exception'] });
            }
            if (!this.isFullRank()) {
                throw Object.defineProperty(new Error("Matrix is rank deficient."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            var nx = B.getColumnDimension();
            var X = B.getArrayCopy();
            for (var k = 0; k < this.n; k++) {
                for (var j = 0; j < nx; j++) {
                    var s = 0.0;
                    for (var i = k; i < this.m; i++) {
                        s += this.QR[i][k] * X[i][j];
                    }
                    ;
                    s = -s / this.QR[k][k];
                    for (var i = k; i < this.m; i++) {
                        X[i][j] += s * this.QR[i][k];
                    }
                    ;
                }
                ;
            }
            ;
            for (var k = this.n - 1; k >= 0; k--) {
                for (var j = 0; j < nx; j++) {
                    X[k][j] /= this.Rdiag[k];
                }
                ;
                for (var i = 0; i < k; i++) {
                    for (var j = 0; j < nx; j++) {
                        X[i][j] -= X[k][j] * this.QR[i][k];
                    }
                    ;
                }
                ;
            }
            ;
            return (new Jama.Matrix(X, this.n, nx).getMatrix$int$int$int$int(0, this.n - 1, 0, nx - 1));
        };
        return QRDecomposition;
    }());
    QRDecomposition.serialVersionUID = 1;
    Jama.QRDecomposition = QRDecomposition;
    QRDecomposition["__class"] = "Jama.QRDecomposition";
    QRDecomposition["__interfaces"] = ["java.io.Serializable"];
})(Jama || (Jama = {}));
(function (Jama) {
    /**
     * Cholesky algorithm for symmetric and positive definite matrix.
     * Structure to access L and isspd flag.
     * @param  {Jama.Matrix} Arg   Square, symmetric matrix.
     * @class
     */
    var CholeskyDecomposition = (function () {
        function CholeskyDecomposition(Arg) {
            this.L = null;
            this.n = 0;
            this.isspd = false;
            var A = Arg.getArray();
            this.n = Arg.getRowDimension();
            this.L = (function (dims) { var allocate = function (dims) { if (dims.length == 0) {
                return 0;
            }
            else {
                var array = [];
                for (var i = 0; i < dims[0]; i++) {
                    array.push(allocate(dims.slice(1)));
                }
                return array;
            } }; return allocate(dims); })([this.n, this.n]);
            this.isspd = (Arg.getColumnDimension() === this.n);
            for (var j = 0; j < this.n; j++) {
                var Lrowj = this.L[j];
                var d = 0.0;
                for (var k = 0; k < j; k++) {
                    var Lrowk = this.L[k];
                    var s = 0.0;
                    for (var i = 0; i < k; i++) {
                        s += Lrowk[i] * Lrowj[i];
                    }
                    ;
                    Lrowj[k] = s = (A[j][k] - s) / this.L[k][k];
                    d = d + s * s;
                    this.isspd = (function (lhs, rhs) { return lhs && rhs; })(this.isspd, (A[k][j] === A[j][k]));
                }
                ;
                d = A[j][j] - d;
                this.isspd = (function (lhs, rhs) { return lhs && rhs; })(this.isspd, (d > 0.0));
                this.L[j][j] = Math.sqrt(Math.max(d, 0.0));
                for (var k = j + 1; k < this.n; k++) {
                    this.L[j][k] = 0.0;
                }
                ;
            }
            ;
        }
        /**
         * Is the matrix symmetric and positive definite?
         * @return     {boolean} true if A is symmetric and positive definite.
         */
        CholeskyDecomposition.prototype.isSPD = function () {
            return this.isspd;
        };
        /**
         * Return triangular factor.
         * @return     {Jama.Matrix} L
         */
        CholeskyDecomposition.prototype.getL = function () {
            return new Jama.Matrix(this.L, this.n, this.n);
        };
        /**
         * Solve A*X = B
         * @param  {Jama.Matrix} B   A Matrix with as many rows as A and any number of columns.
         * @return     {Jama.Matrix} X so that L*L'*X = B
         * @exception  IllegalArgumentException  Matrix row dimensions must agree.
         * @exception  RuntimeException  Matrix is not symmetric positive definite.
         */
        CholeskyDecomposition.prototype.solve = function (B) {
            if (B.getRowDimension() !== this.n) {
                throw Object.defineProperty(new Error("Matrix row dimensions must agree."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.IllegalArgumentException', 'java.lang.Exception'] });
            }
            if (!this.isspd) {
                throw Object.defineProperty(new Error("Matrix is not symmetric positive definite."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            var X = B.getArrayCopy();
            var nx = B.getColumnDimension();
            for (var k = 0; k < this.n; k++) {
                for (var j = 0; j < nx; j++) {
                    for (var i = 0; i < k; i++) {
                        X[k][j] -= X[i][j] * this.L[k][i];
                    }
                    ;
                    X[k][j] /= this.L[k][k];
                }
                ;
            }
            ;
            for (var k = this.n - 1; k >= 0; k--) {
                for (var j = 0; j < nx; j++) {
                    for (var i = k + 1; i < this.n; i++) {
                        X[k][j] -= X[i][j] * this.L[i][k];
                    }
                    ;
                    X[k][j] /= this.L[k][k];
                }
                ;
            }
            ;
            return new Jama.Matrix(X, this.n, nx);
        };
        return CholeskyDecomposition;
    }());
    CholeskyDecomposition.serialVersionUID = 1;
    Jama.CholeskyDecomposition = CholeskyDecomposition;
    CholeskyDecomposition["__class"] = "Jama.CholeskyDecomposition";
    CholeskyDecomposition["__interfaces"] = ["java.io.Serializable"];
})(Jama || (Jama = {}));
(function (Jama) {
    /**
     * LU Decomposition
     * Structure to access L, U and piv.
     * @param  {Jama.Matrix} A Rectangular matrix
     * @class
     */
    var LUDecomposition = (function () {
        function LUDecomposition(A) {
            this.LU = null;
            this.m = 0;
            this.n = 0;
            this.pivsign = 0;
            this.piv = null;
            this.LU = A.getArrayCopy();
            this.m = A.getRowDimension();
            this.n = A.getColumnDimension();
            this.piv = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.m);
            for (var i = 0; i < this.m; i++) {
                this.piv[i] = i;
            }
            ;
            this.pivsign = 1;
            var LUrowi;
            var LUcolj = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.m);
            for (var j = 0; j < this.n; j++) {
                for (var i = 0; i < this.m; i++) {
                    LUcolj[i] = this.LU[i][j];
                }
                ;
                for (var i = 0; i < this.m; i++) {
                    LUrowi = this.LU[i];
                    var kmax = Math.min(i, j);
                    var s = 0.0;
                    for (var k = 0; k < kmax; k++) {
                        s += LUrowi[k] * LUcolj[k];
                    }
                    ;
                    LUrowi[j] = LUcolj[i] -= s;
                }
                ;
                var p = j;
                for (var i = j + 1; i < this.m; i++) {
                    if (Math.abs(LUcolj[i]) > Math.abs(LUcolj[p])) {
                        p = i;
                    }
                }
                ;
                if (p !== j) {
                    for (var k_1 = 0; k_1 < this.n; k_1++) {
                        var t = this.LU[p][k_1];
                        this.LU[p][k_1] = this.LU[j][k_1];
                        this.LU[j][k_1] = t;
                    }
                    ;
                    var k = this.piv[p];
                    this.piv[p] = this.piv[j];
                    this.piv[j] = k;
                    this.pivsign = -this.pivsign;
                }
                if ((function (lhs, rhs) { return lhs && rhs; })(j < this.m, this.LU[j][j] !== 0.0)) {
                    for (var i = j + 1; i < this.m; i++) {
                        this.LU[i][j] /= this.LU[j][j];
                    }
                    ;
                }
            }
            ;
        }
        /**
         * Is the matrix nonsingular?
         * @return     {boolean} true if U, and hence A, is nonsingular.
         */
        LUDecomposition.prototype.isNonsingular = function () {
            for (var j = 0; j < this.n; j++) {
                if (this.LU[j][j] === 0)
                    return false;
            }
            ;
            return true;
        };
        /**
         * Return lower triangular factor
         * @return     {Jama.Matrix} L
         */
        LUDecomposition.prototype.getL = function () {
            var X = new Jama.Matrix(this.m, this.n);
            var L = X.getArray();
            for (var i = 0; i < this.m; i++) {
                for (var j = 0; j < this.n; j++) {
                    if (i > j) {
                        L[i][j] = this.LU[i][j];
                    }
                    else if (i === j) {
                        L[i][j] = 1.0;
                    }
                    else {
                        L[i][j] = 0.0;
                    }
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Return upper triangular factor
         * @return     {Jama.Matrix} U
         */
        LUDecomposition.prototype.getU = function () {
            var X = new Jama.Matrix(this.n, this.n);
            var U = X.getArray();
            for (var i = 0; i < this.n; i++) {
                for (var j = 0; j < this.n; j++) {
                    if (i <= j) {
                        U[i][j] = this.LU[i][j];
                    }
                    else {
                        U[i][j] = 0.0;
                    }
                }
                ;
            }
            ;
            return X;
        };
        /**
         * Return pivot permutation vector
         * @return     {Array} piv
         */
        LUDecomposition.prototype.getPivot = function () {
            var p = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.m);
            for (var i = 0; i < this.m; i++) {
                p[i] = this.piv[i];
            }
            ;
            return p;
        };
        /**
         * Return pivot permutation vector as a one-dimensional double array
         * @return     {Array} (double) piv
         */
        LUDecomposition.prototype.getDoublePivot = function () {
            var vals = (function (s) { var a = []; while (s-- > 0)
                a.push(0); return a; })(this.m);
            for (var i = 0; i < this.m; i++) {
                vals[i] = this.piv[i];
            }
            ;
            return vals;
        };
        /**
         * Determinant
         * @return     {number} det(A)
         * @exception  IllegalArgumentException  Matrix must be square
         */
        LUDecomposition.prototype.det = function () {
            if (this.m !== this.n) {
                throw Object.defineProperty(new Error("Matrix must be square."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.IllegalArgumentException', 'java.lang.Exception'] });
            }
            var d = this.pivsign;
            for (var j = 0; j < this.n; j++) {
                d *= this.LU[j][j];
            }
            ;
            return d;
        };
        /**
         * Solve A*X = B
         * @param  {Jama.Matrix} B   A Matrix with as many rows as A and any number of columns.
         * @return     {Jama.Matrix} X so that L*U*X = B(piv,:)
         * @exception  IllegalArgumentException Matrix row dimensions must agree.
         * @exception  RuntimeException  Matrix is singular.
         */
        LUDecomposition.prototype.solve = function (B) {
            if (B.getRowDimension() !== this.m) {
                throw Object.defineProperty(new Error("Matrix row dimensions must agree."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.IllegalArgumentException', 'java.lang.Exception'] });
            }
            if (!this.isNonsingular()) {
                throw Object.defineProperty(new Error("Matrix is singular."), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.Exception'] });
            }
            var nx = B.getColumnDimension();
            var Xmat = B.getMatrix$int_A$int$int(this.piv, 0, nx - 1);
            var X = Xmat.getArray();
            for (var k = 0; k < this.n; k++) {
                for (var i = k + 1; i < this.n; i++) {
                    for (var j = 0; j < nx; j++) {
                        X[i][j] -= X[k][j] * this.LU[i][k];
                    }
                    ;
                }
                ;
            }
            ;
            for (var k = this.n - 1; k >= 0; k--) {
                for (var j = 0; j < nx; j++) {
                    X[k][j] /= this.LU[k][k];
                }
                ;
                for (var i = 0; i < k; i++) {
                    for (var j = 0; j < nx; j++) {
                        X[i][j] -= X[k][j] * this.LU[i][k];
                    }
                    ;
                }
                ;
            }
            ;
            return Xmat;
        };
        return LUDecomposition;
    }());
    LUDecomposition.serialVersionUID = 1;
    Jama.LUDecomposition = LUDecomposition;
    LUDecomposition["__class"] = "Jama.LUDecomposition";
    LUDecomposition["__interfaces"] = ["java.io.Serializable"];
})(Jama || (Jama = {}));
(function (Jama) {
    var util;
    (function (util) {
        var Maths = (function () {
            function Maths() {
            }
            /**
             * sqrt(a^2 + b^2) without under/overflow.
             * @param {number} a
             * @param {number} b
             * @return {number}
             */
            Maths.hypot = function (a, b) {
                var r;
                if (Math.abs(a) > Math.abs(b)) {
                    r = b / a;
                    r = Math.abs(a) * Math.sqrt(1 + r * r);
                }
                else if (b !== 0) {
                    r = a / b;
                    r = Math.abs(b) * Math.sqrt(1 + r * r);
                }
                else {
                    r = 0.0;
                }
                return r;
            };
            return Maths;
        }());
        util.Maths = Maths;
        Maths["__class"] = "Jama.util.Maths";
    })(util = Jama.util || (Jama.util = {}));
})(Jama || (Jama = {}));

export {
    Jama
};